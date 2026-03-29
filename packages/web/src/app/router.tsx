import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Loading } from '@/components/Loading'

const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage'))
const VerifyEmailPage = lazy(() => import('@/features/auth/pages/VerifyEmailPage'))
const ForgotPasswordPage = lazy(() => import('@/features/auth/pages/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/pages/ResetPasswordPage'))
const CompanyPage = lazy(() => import('@/features/company/pages/CompanyPage'))

function DashboardPage() {
  return <h1>Dashboard</h1>
}

export function AppRoutes() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/empresa" element={<CompanyPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
