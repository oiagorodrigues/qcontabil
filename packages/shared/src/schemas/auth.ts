import { z } from 'zod'

export const loginSchema = z.object({
  email: z.email({ error: 'Invalid email address' }).transform((e) => e.toLowerCase().trim()),
  password: z.string().min(1, 'Password is required'),
})

export const registerSchema = z.object({
  email: z.email({ error: 'Invalid email address' }).transform((e) => e.toLowerCase().trim()),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const forgotPasswordSchema = z.object({
  email: z.email({ error: 'Invalid email address' }).transform((e) => e.toLowerCase().trim()),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token is required'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>
