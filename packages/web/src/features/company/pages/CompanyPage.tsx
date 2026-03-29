import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateCompanyInput } from '@qcontabil/shared'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loading } from '@/components/Loading'
import { companyApi } from '../api/company.api'
import { CompanyForm } from '../components/CompanyForm'
import { CompanyView } from '../components/CompanyView'

type PageMode = 'view' | 'create' | 'edit'

export default function CompanyPage() {
  const [mode, setMode] = useState<PageMode>('view')
  const [serverError, setServerError] = useState('')
  const queryClient = useQueryClient()

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', 'me'],
    queryFn: async () => {
      try {
        const res = await companyApi.getMyCompany()
        return res.data
      } catch (error: unknown) {
        const err = error as { response?: { status?: number } }
        if (err.response?.status === 404) return null
        throw error
      }
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: CreateCompanyInput) => companyApi.createCompany(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', 'me'] })
      setMode('view')
      setServerError('')
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } }
      setServerError(err.response?.data?.message || 'Erro ao cadastrar empresa. Tente novamente.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: CreateCompanyInput) => companyApi.updateCompany(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', 'me'] })
      setMode('view')
      setServerError('')
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } }
      setServerError(err.response?.data?.message || 'Erro ao atualizar empresa. Tente novamente.')
    },
  })

  if (isLoading) return <Loading />

  // Empty state
  if (!company && mode === 'view') {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>Minha Empresa</CardTitle>
            <CardDescription>
              Cadastre os dados da sua empresa para que aparecam nos invoices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setMode('create')}>Cadastrar Empresa</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Create mode
  if (mode === 'create') {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Cadastrar Empresa</h2>
          <Button variant="outline" onClick={() => setMode('view')}>
            Cancelar
          </Button>
        </div>
        {serverError && <p className="mb-4 text-sm text-destructive">{serverError}</p>}
        <CompanyForm
          onSubmit={(data) => createMutation.mutate(data)}
          isSubmitting={createMutation.isPending}
        />
      </div>
    )
  }

  // Edit mode
  if (mode === 'edit' && company) {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Editar Empresa</h2>
          <Button variant="outline" onClick={() => setMode('view')}>
            Cancelar
          </Button>
        </div>
        {serverError && <p className="mb-4 text-sm text-destructive">{serverError}</p>}
        <CompanyForm
          initialData={company}
          onSubmit={(data) => updateMutation.mutate(data)}
          isSubmitting={updateMutation.isPending}
        />
      </div>
    )
  }

  // View mode
  if (company) {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <h2 className="mb-6 text-2xl font-bold">Minha Empresa</h2>
        <CompanyView company={company} onEdit={() => setMode('edit')} />
      </div>
    )
  }

  return null
}
