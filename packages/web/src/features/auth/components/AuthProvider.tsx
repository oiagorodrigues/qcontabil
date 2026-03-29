import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { authApi } from '../api/auth.api'
import { useAuthStore } from '../stores/auth.store'
import { setOnAuthError } from '@/lib/http-client'

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

  const { data, error, isSuccess, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => authApi.me(),
    retry: false,
  })

  useEffect(() => {
    if (isSuccess && data) {
      useAuthStore.getState().setUser(data.data.user)
      useAuthStore.getState().setLoading(false)
    }
  }, [isSuccess, data])

  useEffect(() => {
    if (isError) {
      useAuthStore.getState().clearAuth()
      useAuthStore.getState().setLoading(false)
    }
  }, [isError, error])

  useEffect(() => {
    setOnAuthError(() => {
      useAuthStore.getState().clearAuth()
      navigate('/login')
    })
  }, [navigate])

  return <>{children}</>
}
