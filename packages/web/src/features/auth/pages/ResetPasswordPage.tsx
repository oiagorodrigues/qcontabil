import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
import { resetPasswordSchema } from '@qcontabil/shared'
import type { ResetPasswordInput } from '@qcontabil/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter'
import { authApi } from '../api/auth.api'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const [passwordScore, setPasswordScore] = useState(0)

  const mutation = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => {
      navigate('/login', {
        state: { message: 'Password reset successfully. You can now log in.' },
      })
    },
  })

  const form = useForm({
    defaultValues: { token: token || '', password: '' },
    validators: {
      onChange: resetPasswordSchema,
    },
    onSubmit: ({ value }) => {
      mutation.mutate(value as ResetPasswordInput)
    },
  })

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid link</CardTitle>
            <CardDescription>
              No reset token was provided. Please request a new password reset.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link to="/forgot-password">Request new reset link</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  const isExpiredTokenError =
    mutation.isError && ((mutation.error as Error)?.message || '').toLowerCase().includes('expired')

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
          <CardDescription>Enter your new password below.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              form.handleSubmit()
            }}
            className="space-y-4"
          >
            <form.Field name="password">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter new password"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    aria-invalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}
                  />
                  <PasswordStrengthMeter
                    password={field.state.value}
                    onScoreChange={setPasswordScore}
                  />
                  {field.state.meta.isTouched && field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-destructive">
                      {field.state.meta.errors[0]?.message || String(field.state.meta.errors[0])}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            {mutation.isError && (
              <p className="text-sm text-destructive">
                {isExpiredTokenError
                  ? 'This reset link has expired.'
                  : (mutation.error as Error)?.message || 'Something went wrong. Please try again.'}
              </p>
            )}

            {isExpiredTokenError && (
              <Button variant="link" asChild className="px-0">
                <Link to="/forgot-password">Request a new reset link</Link>
              </Button>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending || passwordScore < 3}
            >
              {mutation.isPending ? 'Resetting...' : 'Reset password'}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <Button variant="link" asChild>
            <Link to="/login">Back to login</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
