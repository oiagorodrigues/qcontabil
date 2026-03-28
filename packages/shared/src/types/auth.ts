export interface UserProfile {
  id: string
  email: string
  emailVerified: boolean
  createdAt: string
}

export interface AuthResponse {
  user: UserProfile
  message?: string
}
