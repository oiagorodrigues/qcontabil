import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { useForm } from '@tanstack/react-form'
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
import { authApi } from '../api/auth.api'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [showResend, setShowResend] = useState(false)

  const verifyMutation = useMutation({
    mutationFn: (t: string) => authApi.verifyEmail({ token: t }),
  })

  const resendMutation = useMutation({
    mutationFn: (email: string) => authApi.resendVerification(email),
  })

  useEffect(() => {
    if (token) {
      verifyMutation.mutate(token)
    }
  }, [token])

  const resendForm = useForm({
    defaultValues: { email: '' },
    onSubmit: ({ value }) => {
      resendMutation.mutate(value.email)
    },
  })

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid link</CardTitle>
            <CardDescription>
              No verification token was provided. Please check your email for the correct link.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="link" asChild>
              <Link to="/login">Back to login</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (verifyMutation.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Verifying your email...</CardTitle>
            <CardDescription>Please wait while we verify your email address.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (verifyMutation.isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Email verified!</CardTitle>
            <CardDescription>
              Your email has been successfully verified. You can now log in.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link to="/login">Go to login</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Verification failed</CardTitle>
          <CardDescription>
            {(verifyMutation.error as Error)?.message ||
              'The verification link is invalid or has expired.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showResend ? (
            <Button variant="outline" onClick={() => setShowResend(true)}>
              Resend verification email
            </Button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                e.stopPropagation()
                resendForm.handleSubmit()
              }}
              className="space-y-4"
            >
              <resendForm.Field name="email">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="resend-email">Email</Label>
                    <Input
                      id="resend-email"
                      type="email"
                      placeholder="you@example.com"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      required
                    />
                  </div>
                )}
              </resendForm.Field>

              {resendMutation.isSuccess && (
                <p className="text-sm text-green-600">
                  If the email exists, a new verification link has been sent.
                </p>
              )}

              {resendMutation.isError && (
                <p className="text-sm text-destructive">Something went wrong. Please try again.</p>
              )}

              <Button type="submit" disabled={resendMutation.isPending}>
                {resendMutation.isPending ? 'Sending...' : 'Send verification email'}
              </Button>
            </form>
          )}
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
