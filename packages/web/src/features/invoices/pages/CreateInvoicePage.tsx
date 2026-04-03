import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Loading } from '@/components/Loading'
import { invoicesApi } from '../api/invoices.api'
import { clientsApi } from '@/features/clients/api/clients.api'
import { companyApi } from '@/features/company/api/company.api'
import { InvoiceForm } from '../components/InvoiceForm'
import { InvoicePreview } from '../components/InvoicePreview'
import type { InvoiceLineItemInput, InvoiceExtraInput, ClientDetail } from '@qcontabil/shared'

interface FormValues {
  clientId: string
  issueDate: string
  dueDate: string
  currency: string
  description: string
  notes: string
  paymentInstructions: string
  lineItems: InvoiceLineItemInput[]
  extras: InvoiceExtraInput[]
}



export default function CreateInvoicePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedClientId = searchParams.get('clientId') || ''

  const [previewValues, setPreviewValues] = useState<FormValues>({
    clientId: preselectedClientId,
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    currency: 'USD',
    description: '',
    notes: '',
    paymentInstructions: '',
    lineItems: [{ description: '', quantity: 1, unitPrice: 0, sortOrder: 0 }],
    extras: [],
  })

  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ['company'],
    queryFn: () => companyApi.getMyCompany(),
    select: (res) => res.data,
  })

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients', { limit: 100 }],
    queryFn: () => clientsApi.list({ limit: 100 }),
    select: (res) => res.data,
  })

  const { data: preselectedClient } = useQuery({
    queryKey: ['clients', preselectedClientId],
    queryFn: () => clientsApi.get(preselectedClientId),
    select: (res) => res.data,
    enabled: !!preselectedClientId,
  })

  const clients = clientsData?.data ?? []

  const createMutation = useMutation({
    mutationFn: invoicesApi.create,
    onSuccess: (res) => {
      navigate(`/invoices/${res.data.id}`)
    },
  })

  if (companyLoading || clientsLoading) return <Loading />

  if (!company) {
    return (
      <div className="container mx-auto max-w-xl py-12 text-center space-y-4">
        <h2 className="text-xl font-semibold">Company info required</h2>
        <p className="text-muted-foreground">
          Set up your company info before creating invoices.
        </p>
        <a href="/company" className="text-primary underline">
          Set up company
        </a>
      </div>
    )
  }

  const selectedClient = clients.find((c) => c.id === previewValues.clientId)
  const clientForPreview: ClientDetail | null = selectedClient
    ? {
        id: selectedClient.id,
        fantasyName: selectedClient.fantasyName,
        company: selectedClient.company,
        email: selectedClient.primaryContactEmail,
        phone: null,
        website: null,
        address: null,
        notes: null,
        currency: selectedClient.currency,
        status: selectedClient.status,
        country: selectedClient.country,
        countryCode: selectedClient.countryCode,
        contacts: [],
        paymentProviderPayeeId: null,
        autoSendDay: null,
        createdAt: '',
        updatedAt: '',
      }
    : preselectedClient ?? null

  return (
    <div className="container mx-auto py-6">
      <h1 className="mb-6 text-3xl font-bold">New Invoice</h1>
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <InvoiceForm
            defaultValues={preselectedClientId ? { clientId: preselectedClientId, currency: preselectedClient?.currency ?? 'USD' } : undefined}
            clients={clients}
            isSubmitting={createMutation.isPending}
            onSubmit={(values) => {
              setPreviewValues(values)
              createMutation.mutate({
                clientId: values.clientId,
                issueDate: values.issueDate,
                dueDate: values.dueDate,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                currency: values.currency as any,
                description: values.description,
                notes: values.notes || undefined,
                paymentInstructions: values.paymentInstructions || undefined,
                lineItems: values.lineItems,
                extras: values.extras,
              })
            }}
          />
        </div>
        <div className="lg:sticky lg:top-6 lg:self-start">
          <p className="text-muted-foreground mb-3 text-sm font-medium">Preview</p>
          <InvoicePreview
            company={company}
            client={clientForPreview}
            issueDate={previewValues.issueDate}
            dueDate={previewValues.dueDate}
            currency={previewValues.currency}
            description={previewValues.description}
            lineItems={previewValues.lineItems}
            extras={previewValues.extras}
            paymentInstructions={previewValues.paymentInstructions || undefined}
          />
        </div>
      </div>
    </div>
  )
}
