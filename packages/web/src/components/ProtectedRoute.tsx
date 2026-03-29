import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuthStore } from '@/features/auth/stores/auth.store'
import { Loading } from '@/components/Loading'

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.user !== null)
  const isLoading = useAuthStore((s) => s.isLoading)
  const location = useLocation()

  if (isLoading) {
    return <Loading />
  }

  if (!isAuthenticated) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  return <Outlet />
}
