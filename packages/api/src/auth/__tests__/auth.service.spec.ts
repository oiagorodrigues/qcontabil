import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common'
import type { Repository, ObjectLiteral } from 'typeorm'
import { AuthService } from '../auth.service'
import type { TokenService } from '../token.service'
import type { MailService } from '../../mail/mail.service'
import type { User } from '../entities/user.entity'
import type { RefreshToken } from '../entities/refresh-token.entity'
import type { EmailToken } from '../entities/email-token.entity'
import * as bcrypt from 'bcrypt'

vi.mock('bcrypt', () => ({
  hash: vi.fn().mockResolvedValue('hashed-password'),
  compare: vi.fn().mockResolvedValue(true),
}))

type MockRepo<T extends ObjectLiteral> = Pick<Repository<T>, 'findOne' | 'create' | 'save' | 'update'>

function createMockRepo<T extends ObjectLiteral>(): MockRepo<T> & {
  findOne: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  save: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
} {
  return {
    findOne: vi.fn(),
    create: vi.fn((data: Partial<T>) => data),
    save: vi.fn().mockImplementation((entity: T) => Promise.resolve(entity)),
    update: vi.fn(),
  } as MockRepo<T> & {
    findOne: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    save: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
}

describe('AuthService', () => {
  let service: AuthService
  let userRepo: ReturnType<typeof createMockRepo<User>>
  let refreshTokenRepo: ReturnType<typeof createMockRepo<RefreshToken>>
  let emailTokenRepo: ReturnType<typeof createMockRepo<EmailToken>>
  let tokenService: Pick<TokenService, 'generateAccessToken' | 'generateRefreshToken' | 'hashToken' | 'getRefreshTokenExpiresAt'>
  let mailService: Pick<MailService, 'sendVerificationEmail' | 'sendPasswordResetEmail'>

  beforeEach(() => {
    userRepo = createMockRepo<User>()
    userRepo.create.mockImplementation((data: Partial<User>) => ({ id: 'user-1', ...data }))

    refreshTokenRepo = createMockRepo<RefreshToken>()
    emailTokenRepo = createMockRepo<EmailToken>()

    tokenService = {
      generateAccessToken: vi.fn().mockReturnValue('access-token'),
      generateRefreshToken: vi.fn().mockReturnValue('refresh-token'),
      hashToken: vi.fn().mockReturnValue('hashed-token'),
      getRefreshTokenExpiresAt: vi.fn().mockReturnValue(
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ),
    }

    mailService = {
      sendVerificationEmail: vi.fn(),
      sendPasswordResetEmail: vi.fn(),
    }

    service = new AuthService(
      userRepo as unknown as Repository<User>,
      refreshTokenRepo as unknown as Repository<RefreshToken>,
      emailTokenRepo as unknown as Repository<EmailToken>,
      tokenService as TokenService,
      mailService as MailService,
    )
  })

  // --- register ---

  describe('register', () => {
    it('creates user with hashed password and sends verification email', async () => {
      userRepo.findOne.mockResolvedValue(null)

      const result = await service.register({ email: 'a@b.com', password: 'StrongP@ss1' })

      expect(bcrypt.hash).toHaveBeenCalledWith('StrongP@ss1', 12)
      expect(userRepo.create).toHaveBeenCalledWith({
        email: 'a@b.com',
        passwordHash: 'hashed-password',
      })
      expect(userRepo.save).toHaveBeenCalled()
      expect(mailService.sendVerificationEmail).toHaveBeenCalled()
      expect(result.message).toContain('verification link')
    })

    it('returns same generic message when email already exists (no enumeration)', async () => {
      userRepo.findOne.mockResolvedValue({ id: 'existing' })

      const result = await service.register({ email: 'a@b.com', password: 'StrongP@ss1' })

      expect(userRepo.create).not.toHaveBeenCalled()
      expect(result.message).toContain('verification link')
    })
  })

  // --- login ---

  describe('login', () => {
    const validUser: Partial<User> = {
      id: 'user-1',
      email: 'a@b.com',
      passwordHash: 'hashed',
      emailVerified: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    }

    it('returns token pair on valid credentials', async () => {
      userRepo.findOne.mockResolvedValue({ ...validUser })
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      const result = await service.login({ email: 'a@b.com', password: 'pass' })

      expect(result.tokenPair).toBeDefined()
      expect(result.user).toBeDefined()
    })

    it('throws UnauthorizedException with timing-safe hash on unknown email', async () => {
      userRepo.findOne.mockResolvedValue(null)

      await expect(service.login({ email: 'x@x.com', password: 'p' })).rejects.toThrow(
        UnauthorizedException,
      )

      expect(bcrypt.hash).toHaveBeenCalled()
    })

    it('throws UnauthorizedException on wrong password and increments failedLoginAttempts', async () => {
      userRepo.findOne.mockResolvedValue({ ...validUser })
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

      await expect(service.login({ email: 'a@b.com', password: 'wrong' })).rejects.toThrow(
        UnauthorizedException,
      )

      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ failedLoginAttempts: 1 }),
      )
    })

    it('locks account after 10 failed attempts', async () => {
      const user = { ...validUser, failedLoginAttempts: 9 }
      userRepo.findOne.mockResolvedValue(user)
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never)

      await expect(service.login({ email: 'a@b.com', password: 'wrong' })).rejects.toThrow(
        UnauthorizedException,
      )

      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          failedLoginAttempts: 10,
          lockedUntil: expect.any(Date),
        }),
      )
    })

    it('throws when account is locked', async () => {
      const user = { ...validUser, lockedUntil: new Date(Date.now() + 60000) }
      userRepo.findOne.mockResolvedValue(user)

      await expect(service.login({ email: 'a@b.com', password: 'pass' })).rejects.toThrow(
        UnauthorizedException,
      )
    })

    it('throws ForbiddenException when email not verified', async () => {
      userRepo.findOne.mockResolvedValue({ ...validUser, emailVerified: false })
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      await expect(service.login({ email: 'a@b.com', password: 'pass' })).rejects.toThrow(
        ForbiddenException,
      )
    })

    it('resets failedLoginAttempts on successful login', async () => {
      const user = { ...validUser, failedLoginAttempts: 3 }
      userRepo.findOne.mockResolvedValue(user)
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never)

      await service.login({ email: 'a@b.com', password: 'pass' })

      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: null }),
      )
    })
  })

  // --- refresh ---

  describe('refresh', () => {
    it('revokes current token, issues new pair with same family', async () => {
      const storedToken = {
        tokenHash: 'hashed-token',
        revoked: false,
        family: 'family-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 60000),
        user: { id: 'user-1', email: 'a@b.com' } as User,
      }
      refreshTokenRepo.findOne.mockResolvedValue(storedToken)

      const result = await service.refresh('raw-token')

      expect(storedToken.revoked).toBe(true)
      expect(refreshTokenRepo.save).toHaveBeenCalledWith(storedToken)
      expect(result.tokenPair).toBeDefined()
    })

    it('throws on invalid token', async () => {
      refreshTokenRepo.findOne.mockResolvedValue(null)

      await expect(service.refresh('bad-token')).rejects.toThrow(UnauthorizedException)
    })

    it('revokes entire family on replay attack (revoked token reuse)', async () => {
      const storedToken = {
        tokenHash: 'hashed-token',
        revoked: true,
        family: 'family-1',
        userId: 'user-1',
        user: { id: 'user-1' } as User,
      }
      refreshTokenRepo.findOne.mockResolvedValue(storedToken)

      await expect(service.refresh('reused-token')).rejects.toThrow(UnauthorizedException)

      expect(refreshTokenRepo.update).toHaveBeenCalledWith(
        { family: 'family-1', revoked: false },
        { revoked: true },
      )
    })

    it('throws on expired token', async () => {
      const storedToken = {
        tokenHash: 'hashed-token',
        revoked: false,
        family: 'family-1',
        expiresAt: new Date(Date.now() - 60000),
        user: { id: 'user-1' } as User,
      }
      refreshTokenRepo.findOne.mockResolvedValue(storedToken)

      await expect(service.refresh('expired-token')).rejects.toThrow(UnauthorizedException)
    })
  })

  // --- verifyEmail ---

  describe('verifyEmail', () => {
    it('marks email as verified and token as used', async () => {
      const emailToken = {
        tokenHash: 'hashed-token',
        type: 'verification' as const,
        used: false,
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 60000),
      }
      emailTokenRepo.findOne.mockResolvedValue(emailToken)

      await service.verifyEmail('raw-token')

      expect(emailToken.used).toBe(true)
      expect(emailTokenRepo.save).toHaveBeenCalled()
      expect(userRepo.update).toHaveBeenCalledWith('user-1', { emailVerified: true })
    })

    it('throws on already used token', async () => {
      emailTokenRepo.findOne.mockResolvedValue({
        used: true,
        expiresAt: new Date(Date.now() + 60000),
      })

      await expect(service.verifyEmail('used-token')).rejects.toThrow(BadRequestException)
    })

    it('throws on expired token', async () => {
      emailTokenRepo.findOne.mockResolvedValue({
        used: false,
        expiresAt: new Date(Date.now() - 60000),
      })

      await expect(service.verifyEmail('expired-token')).rejects.toThrow(BadRequestException)
    })
  })

  // --- resetPassword ---

  describe('resetPassword', () => {
    it('updates password and revokes all refresh tokens', async () => {
      const emailToken = {
        tokenHash: 'hashed-token',
        type: 'password_reset' as const,
        used: false,
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 60000),
      }
      emailTokenRepo.findOne.mockResolvedValue(emailToken)

      await service.resetPassword('raw-token', 'NewStr0ngPass!')

      expect(bcrypt.hash).toHaveBeenCalledWith('NewStr0ngPass!', 12)
      expect(userRepo.update).toHaveBeenCalledWith('user-1', {
        passwordHash: 'hashed-password',
      })
      expect(refreshTokenRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1', revoked: false },
        { revoked: true },
      )
    })

    it('throws on password shorter than 8 chars', async () => {
      await expect(service.resetPassword('token', 'short')).rejects.toThrow(BadRequestException)
    })
  })

  // --- forgotPassword ---

  describe('forgotPassword', () => {
    it('sends reset email for verified user', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        emailVerified: true,
      })

      const result = await service.forgotPassword('a@b.com')

      expect(mailService.sendPasswordResetEmail).toHaveBeenCalled()
      expect(result.message).toContain('reset link')
    })

    it('sends verification email for unverified user', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        emailVerified: false,
      })

      await service.forgotPassword('a@b.com')

      expect(mailService.sendVerificationEmail).toHaveBeenCalled()
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled()
    })

    it('returns same generic message for nonexistent email (no enumeration)', async () => {
      userRepo.findOne.mockResolvedValue(null)

      const result = await service.forgotPassword('nobody@x.com')

      expect(result.message).toContain('reset link')
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled()
    })
  })

  // --- getProfile ---

  describe('getProfile', () => {
    it('returns user profile', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        emailVerified: true,
        createdAt: new Date('2026-01-01'),
      })

      const result = await service.getProfile('user-1')

      expect(result).toEqual({
        id: 'user-1',
        email: 'a@b.com',
        emailVerified: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      })
    })

    it('throws UnauthorizedException for nonexistent user', async () => {
      userRepo.findOne.mockResolvedValue(null)

      await expect(service.getProfile('bad-id')).rejects.toThrow(UnauthorizedException)
    })
  })
})
