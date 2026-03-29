import type { UserProfile } from '@qcontabil/shared'
import { create } from 'zustand'

interface AuthState {
  user: UserProfile | null
  isLoading: boolean
  readonly isAuthenticated: boolean
  setUser: (user: UserProfile) => void
  clearAuth: () => void
  setLoading: (isLoading: boolean) => void
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isLoading: true,

  get isAuthenticated() {
    return get().user !== null
  },

  setUser: (user) => set({ user }),
  clearAuth: () => set({ user: null }),
  setLoading: (isLoading) => set({ isLoading }),
}))
