import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { authApi } from '../api/auth.api'
import { useAuthStore } from '../stores/auth.store'
import { setOnAuthError } from '@/lib/http-client'

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { setUser, setLoading, clearAuth } = useAuthStore.getState()

  const { data, isSuccess, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    retry: 1,
  })

  useEffect(() => {
    if (isSuccess && data) {
      setUser(data.data.user)
      setLoading(false)
    }
  }, [isSuccess, data, setUser, setLoading])

  useEffect(() => {
    if (isError) {
      clearAuth()
      setLoading(false)
    }
  }, [isError, clearAuth, setLoading])

  useEffect(() => {
    setOnAuthError(() => {
      clearAuth()
      navigate('/login')
    })
  }, [navigate, clearAuth])

  return <>{children}</>
}
