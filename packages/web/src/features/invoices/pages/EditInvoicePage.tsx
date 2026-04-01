import { useNavigate, useParams } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loading } from '@/components/Loading'
import { invoicesApi } from '../api/invoices.api'
import { clientsApi } from '@/features/clients/api/clients.api'
import { companyApi } from '@/features/company/api/company.api'
import { InvoiceForm } from '../components/InvoiceForm'
import { InvoicePreview } from '../components/InvoicePreview'
import type { ClientDetail } from '@qcontabil/shared'

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: invoice, isLoading: invoiceLoading } = useQuery({
    queryKey: ['invoices', id],
    queryFn: () => invoicesApi.get(id!),
    select: (res) => res.data,
    enabled: !!id,
  })

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: () => companyApi.getMyCompany(),
    select: (res) => res.data,
  })

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients', { limit: 100 }],
    queryFn: () => clientsApi.list({ limit: 100 }),
    select: (res) => res.data,
  })

  const clients = clientsData?.data ?? []

  const updateMutation = useMutation({
    mutationFn: (values: Parameters<typeof invoicesApi.update>[1]) =>
      invoicesApi.update(id!, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      navigate(`/invoices/${id}`)
    },
  })

  if (invoiceLoading || clientsLoading) return <Loading />

  if (!invoice) {
    return (
      <div className="container mx-auto py-6 text-center">
        <p className="text-muted-foreground">Invoice not found</p>
      </div>
    )
  }

  if (invoice.status !== 'draft') {
    navigate(`/invoices/${id}`)
    return null
  }

  const selectedClient = clients.find((c) => c.id === invoice.clientId)
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
        createdAt: '',
        updatedAt: '',
      }
    : null

  return (
    <div className="container mx-auto py-6">
      <h1 className="mb-6 text-3xl font-bold">Edit Invoice {invoice.invoiceNumber}</h1>
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <InvoiceForm
            defaultValues={{
              clientId: invoice.clientId,
              issueDate: invoice.issueDate,
              dueDate: invoice.dueDate,
              currency: invoice.currency,
              description: invoice.description,
              notes: invoice.notes ?? '',
              paymentInstructions: invoice.paymentInstructions ?? '',
              lineItems: invoice.lineItems.map((li) => ({
                description: li.description,
                quantity: li.quantity,
                unitPrice: li.unitPrice,
                sortOrder: li.sortOrder,
              })),
              extras: invoice.extraItems.map((e) => ({
                description: e.description,
                amount: e.amount,
                sortOrder: e.sortOrder,
              })),
            }}
            clients={clients}
            isSubmitting={updateMutation.isPending}
            onSubmit={(values) => {
              updateMutation.mutate({
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
            company={company ?? null}
            client={clientForPreview}
            invoiceNumber={invoice.invoiceNumber}
            issueDate={invoice.issueDate}
            dueDate={invoice.dueDate}
            currency={invoice.currency}
            description={invoice.description}
            lineItems={invoice.lineItems.map((li) => ({
              description: li.description,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
            }))}
            extras={invoice.extraItems.map((e) => ({
              description: e.description,
              amount: e.amount,
            }))}
            paymentInstructions={invoice.paymentInstructions ?? undefined}
          />
        </div>
      </div>
    </div>
  )
}
