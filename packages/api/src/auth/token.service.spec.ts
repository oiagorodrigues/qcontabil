import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { JwtService } from '@nestjs/jwt'
import type { ConfigService } from '@nestjs/config'
import { TokenService } from './token.service'
import type { User } from './entities/user.entity'
import { createHash } from 'crypto'

describe('TokenService', () => {
  let service: TokenService

  const mockJwtService: Pick<JwtService, 'sign'> = {
    sign: vi.fn().mockReturnValue('signed-jwt-token'),
  }

  const mockConfigService = {
    get: vi.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        ACCESS_TOKEN_TTL_MINUTES: '15',
        REFRESH_TOKEN_TTL_DAYS: '7',
        NODE_ENV: 'test',
      }
      return config[key] ?? defaultValue
    }),
  } as unknown as ConfigService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new TokenService(
      mockJwtService as JwtService,
      mockConfigService,
    )
  })

  describe('generateAccessToken', () => {
    it('signs JWT with user sub and email', () => {
      const user = { id: 'user-123', email: 'a@b.com' } as User
      const result = service.generateAccessToken(user)

      expect(result).toBe('signed-jwt-token')
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: 'user-123', email: 'a@b.com' },
        { expiresIn: 900 },
      )
    })
  })

  describe('generateRefreshToken', () => {
    it('returns a 128-char hex string (64 bytes)', () => {
      const token = service.generateRefreshToken()
      expect(token).toMatch(/^[0-9a-f]{128}$/)
    })

    it('generates unique tokens', () => {
      const a = service.generateRefreshToken()
      const b = service.generateRefreshToken()
      expect(a).not.toBe(b)
    })
  })

  describe('hashToken', () => {
    it('returns SHA-256 hex digest', () => {
      const input = 'test-token'
      const expected = createHash('sha256').update(input).digest('hex')
      expect(service.hashToken(input)).toBe(expected)
    })

    it('is deterministic', () => {
      expect(service.hashToken('x')).toBe(service.hashToken('x'))
    })
  })

  describe('getRefreshTokenExpiresAt', () => {
    it('returns a date ~7 days in the future', () => {
      const result = service.getRefreshTokenExpiresAt()
      const diff = result.getTime() - Date.now()
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
      expect(diff).toBeGreaterThan(sevenDaysMs - 5000)
      expect(diff).toBeLessThan(sevenDaysMs + 5000)
    })
  })

  describe('setAuthCookies', () => {
    it('sets access_token and refresh_token cookies with correct options', () => {
      const mockRes = { cookie: vi.fn() } as unknown as import('express').Response

      service.setAuthCookies(mockRes, 'at', 'rt')

      expect(vi.mocked(mockRes.cookie)).toHaveBeenCalledTimes(2)
      expect(vi.mocked(mockRes.cookie)).toHaveBeenCalledWith('access_token', 'at', {
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        maxAge: 900000,
      })
      expect(vi.mocked(mockRes.cookie)).toHaveBeenCalledWith('refresh_token', 'rt', {
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        path: '/api/auth/refresh',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
    })
  })

  describe('clearAuthCookies', () => {
    it('clears both cookies', () => {
      const mockRes = { clearCookie: vi.fn() } as unknown as import('express').Response

      service.clearAuthCookies(mockRes)

      expect(vi.mocked(mockRes.clearCookie)).toHaveBeenCalledTimes(2)
      expect(vi.mocked(mockRes.clearCookie)).toHaveBeenCalledWith(
        'access_token',
        expect.objectContaining({ httpOnly: true }),
      )
      expect(vi.mocked(mockRes.clearCookie)).toHaveBeenCalledWith(
        'refresh_token',
        expect.objectContaining({ path: '/api/auth/refresh' }),
      )
    })
  })
})
