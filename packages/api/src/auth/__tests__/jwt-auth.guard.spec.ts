import { describe, it, expect, vi } from 'vitest'
import type { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtAuthGuard } from '../guards/jwt-auth.guard'

describe('JwtAuthGuard', () => {
  const createMockContext = (): ExecutionContext =>
    ({
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: vi.fn(),
    }) as unknown as ExecutionContext

  it('allows access when @Public() is set', () => {
    const reflector = new Reflector()
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true)

    const guard = new JwtAuthGuard(reflector)
    const ctx = createMockContext()

    expect(guard.canActivate(ctx)).toBe(true)
  })

  it('delegates to parent AuthGuard when not public', async () => {
    const reflector = new Reflector()
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false)

    const guard = new JwtAuthGuard(reflector)
    const ctx = createMockContext()

    // super.canActivate returns a promise that rejects without real passport setup
    await expect(guard.canActivate(ctx)).rejects.toThrow()
  })
})
