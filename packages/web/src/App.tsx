import { AuthProvider } from '@/features/auth/components/AuthProvider'
import { AppRoutes } from '@/app/router'

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
