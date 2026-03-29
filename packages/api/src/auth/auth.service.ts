import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import * as bcrypt from 'bcrypt'
import { randomBytes } from 'crypto'
import { User } from './entities/user.entity'
import { RefreshToken } from './entities/refresh-token.entity'
import { EmailToken } from './entities/email-token.entity'
import { TokenService } from './token.service'
import { MailService } from '../mail/mail.service'
import type { RegisterInput, LoginInput, UserProfile } from '@qcontabil/shared'

const BCRYPT_ROUNDS = 12
const VERIFICATION_TOKEN_TTL_HOURS = 24
const RESET_TOKEN_TTL_HOURS = 1
const MAX_FAILED_ATTEMPTS = 10
const LOCKOUT_MINUTES = 30

interface TokenPair {
  accessToken: string
  refreshToken: string
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(EmailToken)
    private readonly emailTokenRepository: Repository<EmailToken>,
    private readonly tokenService: TokenService,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterInput): Promise<{ message: string }> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    })

    if (existing) {
      // Generic response to prevent user enumeration
      return { message: 'If the email is available, a verification link has been sent' }
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS)

    const user = this.userRepository.create({
      email: dto.email,
      passwordHash,
    })
    await this.userRepository.save(user)

    await this.createAndSendVerificationEmail(user)

    return { message: 'If the email is available, a verification link has been sent' }
  }

  async login(dto: LoginInput): Promise<{ tokenPair: TokenPair; user: User }> {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    })

    if (!user) {
      // Timing-safe: hash anyway to prevent timing attacks
      await bcrypt.hash(dto.password, BCRYPT_ROUNDS)
      throw new UnauthorizedException('Invalid email or password')
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account temporarily locked. Try again later')
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash)

    if (!passwordValid) {
      user.failedLoginAttempts += 1

      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
        this.logger.warn(`Account locked: ${user.email}`)
      }

      await this.userRepository.save(user)
      throw new UnauthorizedException('Invalid email or password')
    }

    if (!user.emailVerified) {
      throw new ForbiddenException('Please verify your email first')
    }

    // Reset failed attempts on successful login
    if (user.failedLoginAttempts > 0) {
      user.failedLoginAttempts = 0
      user.lockedUntil = null
      await this.userRepository.save(user)
    }

    const tokenPair = await this.createTokenPair(user)
    return { tokenPair, user }
  }

  async refresh(rawRefreshToken: string): Promise<{ tokenPair: TokenPair; user: User }> {
    const tokenHash = this.tokenService.hashToken(rawRefreshToken)

    const storedToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
      relations: ['user'],
    })

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token')
    }

    // Replay attack detection: if token is revoked, revoke entire family
    if (storedToken.revoked) {
      await this.revokeTokenFamily(storedToken.family)
      this.logger.warn(
        `Replay attack detected for user ${storedToken.userId}, family ${storedToken.family}`,
      )
      throw new UnauthorizedException('Token reuse detected. All sessions revoked')
    }

    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired')
    }

    // Revoke current token (one-time use)
    storedToken.revoked = true
    await this.refreshTokenRepository.save(storedToken)

    // Issue new pair with same family
    const tokenPair = await this.createTokenPair(storedToken.user, storedToken.family)

    return { tokenPair, user: storedToken.user }
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.tokenService.hashToken(rawRefreshToken)
    await this.refreshTokenRepository.update({ tokenHash }, { revoked: true })
  }

  async verifyEmail(token: string): Promise<void> {
    const emailToken = await this.findValidEmailToken(token, 'verification')

    emailToken.used = true
    await this.emailTokenRepository.save(emailToken)

    await this.userRepository.update(emailToken.userId, { emailVerified: true })
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { email } })

    if (user && !user.emailVerified) {
      await this.createAndSendVerificationEmail(user)
    }

    // Always return same message to prevent enumeration
    return { message: 'If the email exists and is unverified, a new link has been sent' }
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { email } })

    if (user) {
      // If user exists but email not verified, send verification instead
      if (!user.emailVerified) {
        await this.createAndSendVerificationEmail(user)
      } else {
        const rawToken = randomBytes(32).toString('hex')
        const tokenHash = this.tokenService.hashToken(rawToken)

        const emailToken = this.emailTokenRepository.create({
          tokenHash,
          type: 'password_reset',
          userId: user.id,
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_HOURS * 60 * 60 * 1000),
        })
        await this.emailTokenRepository.save(emailToken)

        await this.mailService.sendPasswordResetEmail(user.email, rawToken)
      }
    }

    return { message: 'If the email exists, a reset link has been sent' }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters')
    }

    const emailToken = await this.findValidEmailToken(token, 'password_reset')

    emailToken.used = true
    await this.emailTokenRepository.save(emailToken)

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
    await this.userRepository.update(emailToken.userId, { passwordHash })

    // Invalidate all refresh tokens for this user
    await this.refreshTokenRepository.update(
      { userId: emailToken.userId, revoked: false },
      { revoked: true },
    )
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.userRepository.findOne({ where: { id: userId } })

    if (!user) {
      throw new UnauthorizedException()
    }

    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
    }
  }

  // --- Private helpers ---

  private async createTokenPair(user: User, family?: string): Promise<TokenPair> {
    const accessToken = this.tokenService.generateAccessToken(user)
    const rawRefreshToken = this.tokenService.generateRefreshToken()
    const tokenHash = this.tokenService.hashToken(rawRefreshToken)

    const refreshToken = this.refreshTokenRepository.create({
      tokenHash,
      family: family ?? crypto.randomUUID(),
      userId: user.id,
      expiresAt: this.tokenService.getRefreshTokenExpiresAt(),
    })
    await this.refreshTokenRepository.save(refreshToken)

    return { accessToken, refreshToken: rawRefreshToken }
  }

  private async revokeTokenFamily(family: string): Promise<void> {
    await this.refreshTokenRepository.update({ family, revoked: false }, { revoked: true })
  }

  private async createAndSendVerificationEmail(user: User): Promise<void> {
    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = this.tokenService.hashToken(rawToken)

    const emailToken = this.emailTokenRepository.create({
      tokenHash,
      type: 'verification',
      userId: user.id,
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000),
    })
    await this.emailTokenRepository.save(emailToken)

    await this.mailService.sendVerificationEmail(user.email, rawToken)
  }

  private async findValidEmailToken(
    rawToken: string,
    type: 'verification' | 'password_reset',
  ): Promise<EmailToken> {
    const tokenHash = this.tokenService.hashToken(rawToken)

    const emailToken = await this.emailTokenRepository.findOne({
      where: { tokenHash, type },
    })

    if (!emailToken) {
      throw new BadRequestException('Token is invalid or has expired')
    }

    if (emailToken.used) {
      throw new BadRequestException('Token has already been used')
    }

    if (emailToken.expiresAt < new Date()) {
      throw new BadRequestException('Token is invalid or has expired')
    }

    return emailToken
  }
}
