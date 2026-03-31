import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import type { CreateClientInput } from '@qcontabil/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getErrorMessage } from '@/lib/utils'
import { clientsApi } from '../api/clients.api'
import { ClientForm } from '../components/ClientForm'

export default function CreateClientPage() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')

  const mutation = useMutation({
    mutationFn: (data: CreateClientInput) => clientsApi.create(data),
    onSuccess: (response) => {
      navigate(`/clients/${response.data.id}`)
    },
    onError: (error: unknown) => {
      setServerError(getErrorMessage(error))
    },
  })

  return (
    <div className="container mx-auto max-w-3xl py-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">New Client</CardTitle>
        </CardHeader>
        <CardContent>
          {serverError && <p className="mb-4 text-sm text-destructive">{serverError}</p>}
          <ClientForm
            onSubmit={(data) => mutation.mutate(data)}
            isSubmitting={mutation.isPending}
          />
        </CardContent>
      </Card>
    </div>
  )
}
