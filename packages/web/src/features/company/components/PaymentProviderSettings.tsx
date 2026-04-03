import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { paymentProviderConfigSchema } from '@qcontabil/shared'
import type { PaymentProviderConfigInput, CompanyResponse } from '@qcontabil/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { companyApi } from '../api/company.api'

interface PaymentProviderSettingsProps {
  company: CompanyResponse
  onSaved: () => void
}

export function PaymentProviderSettings({ company, onSaved }: PaymentProviderSettingsProps) {
  const [apiKey, setApiKey] = useState('')
  const [payerEntity, setPayerEntity] = useState('')
  const [sandboxMode, setSandboxMode] = useState(true)
  const [testResult, setTestResult] = useState<{ valid: boolean; message?: string } | null>(null)
  const [formError, setFormError] = useState('')

  const saveMutation = useMutation({
    mutationFn: (data: PaymentProviderConfigInput) => companyApi.updatePaymentConfig(data),
    onSuccess: () => {
      setFormError('')
      onSaved()
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } }
      setFormError(err.response?.data?.message || 'Failed to save payment configuration.')
    },
  })

  const testMutation = useMutation({
    mutationFn: () => companyApi.testConnection(),
    onSuccess: (res) => {
      setTestResult(res.data)
    },
    onError: () => {
      setTestResult({ valid: false, message: 'Connection test failed.' })
    },
  })

  function handleSave() {
    const result = paymentProviderConfigSchema.safeParse({
      paymentProvider: 'tipalti',
      apiKey,
      payerEntity,
      sandboxMode,
    })
    if (!result.success) {
      setFormError(result.error.issues[0]?.message ?? 'Invalid configuration.')
      return
    }
    saveMutation.mutate(result.data)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Payment Provider</CardTitle>
            <CardDescription>
              Configure your payment platform integration to send invoices automatically.
            </CardDescription>
          </div>
          {company.hasPaymentProvider && (
            <Badge variant="default" className="shrink-0">
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {company.hasPaymentProvider && (
          <p className="text-sm text-muted-foreground">
            Provider: <span className="font-medium capitalize">{company.paymentProvider}</span>
            {' · '}
            <button
              type="button"
              className="text-primary underline"
              onClick={() => {
                setApiKey('')
                setPayerEntity('')
              }}
            >
              Reconfigure
            </button>
          </p>
        )}

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="paymentProvider">Provider</Label>
            <Input id="paymentProvider" value="Tipalti" disabled />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="apiKey">API Key *</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your Tipalti API key"
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="payerEntity">Payer Entity *</Label>
            <Input
              id="payerEntity"
              value={payerEntity}
              onChange={(e) => setPayerEntity(e.target.value)}
              placeholder="Your Tipalti payer entity name"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              id="sandboxMode"
              type="checkbox"
              checked={sandboxMode}
              onChange={(e) => setSandboxMode(e.target.checked)}
              className="h-4 w-4 rounded border"
            />
            <Label htmlFor="sandboxMode" className="cursor-pointer font-normal">
              Sandbox mode (for testing)
            </Label>
          </div>
        </div>

        {formError && <p className="text-sm text-destructive">{formError}</p>}

        {testResult && (
          <p className={`text-sm ${testResult.valid ? 'text-green-600' : 'text-destructive'}`}>
            {testResult.valid ? '✓ Connection successful' : `✗ ${testResult.message ?? 'Connection failed'}`}
          </p>
        )}

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
          <Button
            variant="outline"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending}
          >
            {testMutation.isPending ? 'Testing...' : 'Test Connection'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
