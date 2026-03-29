import { describe, it, expect } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import { z } from 'zod'
import { ZodValidationPipe } from '../zod-validation.pipe'

describe('ZodValidationPipe', () => {
  const schema = z.object({
    email: z.string().email(),
    age: z.number().min(18),
  })
  const pipe = new ZodValidationPipe(schema)

  it('returns parsed data for valid input', () => {
    const result = pipe.transform({ email: 'a@b.com', age: 25 })
    expect(result).toEqual({ email: 'a@b.com', age: 25 })
  })

  it('throws BadRequestException with structured errors for invalid input', () => {
    try {
      pipe.transform({ email: 'not-email', age: 5 })
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException)
      const response = (e as BadRequestException).getResponse() as Record<string, unknown>
      expect(response.message).toBe('Validation failed')
      expect(response.errors).toBeDefined()
    }
  })

  it('strips unknown fields', () => {
    const result = pipe.transform({ email: 'a@b.com', age: 25, extra: true })
    expect(result).toEqual({ email: 'a@b.com', age: 25 })
  })

  it('applies transforms', () => {
    const transformPipe = new ZodValidationPipe(
      z.object({ email: z.string().transform((e) => e.toLowerCase()) }),
    )
    const result = transformPipe.transform({ email: 'UPPER@EMAIL.COM' })
    expect(result).toEqual({ email: 'upper@email.com' })
  })
})
