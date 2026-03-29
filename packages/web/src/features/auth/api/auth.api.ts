import type {
  AuthResponse,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from '@qcontabil/shared'

import { httpClient } from '../../../lib/http-client'

export const authApi = {
  login(data: LoginInput) {
    return httpClient.post<AuthResponse>('/auth/login', data)
  },

  register(data: RegisterInput) {
    return httpClient.post<AuthResponse>('/auth/register', data)
  },

  logout() {
    return httpClient.post('/auth/logout')
  },

  refresh() {
    return httpClient.post('/auth/refresh')
  },

  verifyEmail(data: VerifyEmailInput) {
    return httpClient.post('/auth/verify-email', data)
  },

  resendVerification(email: string) {
    return httpClient.post('/auth/resend-verification', { email })
  },

  forgotPassword(data: ForgotPasswordInput) {
    return httpClient.post('/auth/forgot-password', data)
  },

  resetPassword(data: ResetPasswordInput) {
    return httpClient.post('/auth/reset-password', data)
  },

  me() {
    return httpClient.get<AuthResponse>('/auth/me')
  },
}
