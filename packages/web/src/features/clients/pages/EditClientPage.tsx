import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UpdateClientInput } from '@qcontabil/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loading } from '@/components/Loading'
import { getErrorMessage } from '@/lib/utils'
import { clientsApi } from '../api/clients.api'
import { ClientForm } from '../components/ClientForm'

export default function EditClientPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState('')

  const { data: client, isLoading } = useQuery({
    queryKey: ['clients', id],
    queryFn: () => clientsApi.get(id!),
    select: (res) => res.data,
    enabled: !!id,
  })

  const mutation = useMutation({
    mutationFn: (data: UpdateClientInput) => clientsApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      navigate(`/clients/${id}`)
    },
    onError: (error: unknown) => {
      setServerError(getErrorMessage(error))
    },
  })

  if (isLoading) return <Loading />

  if (!client) {
    return (
      <div className="container mx-auto py-6 text-center">
        <p className="text-muted-foreground">Client not found</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl py-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Edit Client</CardTitle>
        </CardHeader>
        <CardContent>
          {serverError && <p className="mb-4 text-sm text-destructive">{serverError}</p>}
          <ClientForm
            initialData={client}
            onSubmit={(data) => mutation.mutate(data)}
            isSubmitting={mutation.isPending}
          />
        </CardContent>
      </Card>
    </div>
  )
}
