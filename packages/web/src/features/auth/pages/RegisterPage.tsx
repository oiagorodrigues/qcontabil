import { useState } from 'react'
import { Link } from 'react-router'
import { useForm } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { registerSchema } from '@qcontabil/shared'
import type { RegisterInput } from '@qcontabil/shared'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getErrorMessage } from '@/lib/utils'
import { authApi } from '../api/auth.api'
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter'

export default function RegisterPage() {
  const [serverError, setServerError] = useState('')
  const [passwordScore, setPasswordScore] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  const mutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: () => {
      setSubmitted(true)
    },
    onError: () => {
      setServerError('Registration failed. Please try again.')
    },
  })

  const form = useForm({
    defaultValues: { email: '', password: '' } as RegisterInput,
    validators: {
      onChange: registerSchema,
    },
    onSubmit: ({ value }) => {
      if (passwordScore < 3) return
      setServerError('')
      mutation.mutate(value)
    },
  })

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription>
              We sent a verification link to your email address. Please check your inbox and click
              the link to verify your account.
            </CardDescription>
          </CardHeader>
          <CardFooter className="text-sm">
            <Link to="/login" className="text-primary hover:underline">
              Back to login
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Create account</CardTitle>
          <CardDescription>Enter your details to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              form.handleSubmit()
            }}
            className="space-y-4"
          >
            <form.Field name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="you@example.com"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={field.state.meta.errors.length > 0}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-destructive">
                      {getErrorMessage(field.state.meta.errors[0])}
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            <form.Field name="password">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <Input
                    id="register-password"
                    type="password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={field.state.meta.errors.length > 0}
                  />
                  {field.state.meta.errors.length > 0 && (
                    <p className="text-sm text-destructive">
                      {getErrorMessage(field.state.meta.errors[0])}
                    </p>
                  )}
                  <PasswordStrengthMeter
                    password={field.state.value}
                    onScoreChange={setPasswordScore}
                  />
                  {passwordScore < 3 && field.state.value.length >= 8 && (
                    <p className="text-sm text-destructive">
                      Password is too weak. Please choose a stronger password.
                    </p>
                  )}
                </div>
              )}
            </form.Field>

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}

            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending || passwordScore < 3}
            >
              {mutation.isPending ? 'Creating account...' : 'Create account'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-sm">
          <span className="text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </span>
        </CardFooter>
      </Card>
    </div>
  )
}
