import { Injectable } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { ConfigService } from "@nestjs/config"
import { randomBytes, createHash } from "crypto"
import type { Response } from "express"
import type { User } from "./entities/user.entity"

interface AccessTokenPayload {
  sub: string
  email: string
}

@Injectable()
export class TokenService {
  private readonly accessTokenTtlSeconds: number
  private readonly refreshTokenTtlMs: number
  private readonly isProduction: boolean

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    this.accessTokenTtlSeconds =
      Number(this.config.get<string>("ACCESS_TOKEN_TTL_MINUTES", "15")) * 60
    this.refreshTokenTtlMs =
      Number(this.config.get<string>("REFRESH_TOKEN_TTL_DAYS", "7")) *
      24 *
      60 *
      60 *
      1000
    this.isProduction = this.config.get<string>("NODE_ENV") === "production"
  }

  generateAccessToken(user: User): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
    }
    return this.jwtService.sign(payload, {
      expiresIn: this.accessTokenTtlSeconds,
    })
  }

  generateRefreshToken(): string {
    return randomBytes(64).toString("hex")
  }

  hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex")
  }

  getRefreshTokenExpiresAt(): Date {
    return new Date(Date.now() + this.refreshTokenTtlMs)
  }

  setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    const cookieOptions = {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: "strict" as const,
    }

    res.cookie("access_token", accessToken, {
      ...cookieOptions,
      maxAge: this.accessTokenTtlSeconds * 1000,
    })

    res.cookie("refresh_token", refreshToken, {
      ...cookieOptions,
      path: "/api/auth/refresh",
      maxAge: this.refreshTokenTtlMs,
    })
  }

  clearAuthCookies(res: Response): void {
    const cookieOptions = {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: "strict" as const,
    }

    res.clearCookie("access_token", cookieOptions)
    res.clearCookie("refresh_token", {
      ...cookieOptions,
      path: "/api/auth/refresh",
    })
  }
}
