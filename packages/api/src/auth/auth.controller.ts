import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UsePipes,
} from "@nestjs/common"
import { Throttle } from "@nestjs/throttler"
import type { Request, Response } from "express"
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@qcontabil/shared"
import type { LoginInput, RegisterInput } from "@qcontabil/shared"
import { AuthService } from "./auth.service"
import { TokenService } from "./token.service"
import { Public } from "./decorators/public.decorator"
import { CurrentUser } from "./decorators/current-user.decorator"
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe"
import type { User } from "./entities/user.entity"

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
  ) {}

  @Public()
  @Post("register")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @UsePipes(new ZodValidationPipe(registerSchema))
  async register(@Body() dto: RegisterInput) {
    return this.authService.register(dto)
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(
    @Body() dto: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { tokenPair, user } = await this.authService.login(dto)

    this.tokenService.setAuthCookies(
      res,
      tokenPair.accessToken,
      tokenPair.refreshToken,
    )

    return {
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt.toISOString(),
      },
    }
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken = req.cookies?.refresh_token

    if (!rawRefreshToken) {
      this.tokenService.clearAuthCookies(res)
      return { message: "No refresh token" }
    }

    const { tokenPair, user } = await this.authService.refresh(rawRefreshToken)

    this.tokenService.setAuthCookies(
      res,
      tokenPair.accessToken,
      tokenPair.refreshToken,
    )

    return {
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt.toISOString(),
      },
    }
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawRefreshToken = req.cookies?.refresh_token

    if (rawRefreshToken) {
      await this.authService.logout(rawRefreshToken)
    }

    this.tokenService.clearAuthCookies(res)
    return { message: "Logged out" }
  }

  @Public()
  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(verifyEmailSchema))
  async verifyEmail(@Body() dto: { token: string }) {
    await this.authService.verifyEmail(dto.token)
    return { message: "Email verified successfully" }
  }

  @Public()
  @Post("resend-verification")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  async resendVerification(@Body() dto: { email: string }) {
    return this.authService.resendVerification(dto.email)
  }

  @Public()
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @UsePipes(new ZodValidationPipe(forgotPasswordSchema))
  async forgotPassword(@Body() dto: { email: string }) {
    return this.authService.forgotPassword(dto.email)
  }

  @Public()
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(resetPasswordSchema))
  async resetPassword(@Body() dto: { token: string; password: string }) {
    await this.authService.resetPassword(dto.token, dto.password)
    return { message: "Password reset successfully" }
  }

  @Get("me")
  async me(@CurrentUser() user: User) {
    return this.authService.getProfile(user.id)
  }
}
