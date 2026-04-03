import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, Edit, ArrowLeft, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loading } from '@/components/Loading'
import { invoicesApi } from '../api/invoices.api'
import { companyApi } from '@/features/company/api/company.api'
import { InvoiceStatusBadge } from '../components/InvoiceStatusBadge'
import { StatusChangeDialog } from '../components/StatusChangeDialog'
import { InvoicePreview } from '../components/InvoicePreview'
import type { InvoiceDetail } from '@qcontabil/shared'

type StatusAction = 'send' | 'pay' | 'cancel'

function getNextStatus(action: StatusAction): string {
  const map: Record<StatusAction, string> = { send: 'sent', pay: 'paid', cancel: 'cancelled' }
  return map[action]
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [dialogAction, setDialogAction] = useState<StatusAction | null>(null)

  const { data: invoice, isLoading } = useQuery({
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

  const statusMutation = useMutation({
    mutationFn: (action: StatusAction) =>
      invoicesApi.updateStatus(id!, { status: getNextStatus(action) as InvoiceDetail['status'] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      setDialogAction(null)
    },
    onError: () => {
      console.error('Failed to update invoice status')
    },
  })

  const sendToProviderMutation = useMutation({
    mutationFn: () => invoicesApi.submitToPaymentProvider(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', id] })
    },
    onError: () => {
      console.error('Failed to send invoice to payment provider')
    },
  })

  if (isLoading) return <Loading />

  if (!invoice) {
    return (
      <div className="container mx-auto py-6 text-center">
        <p className="text-muted-foreground">Invoice not found</p>
      </div>
    )
  }

  const isDraft = invoice.status === 'draft'
  const isSent = invoice.status === 'sent'
  const canEdit = isDraft
  const canSend = isDraft
  const canPay = isSent
  const canCancel = isDraft || isSent

  const canSendViaProvider = (isDraft || isSent) && !invoice.paymentProviderRef
  const hasPayeeId = !!invoice.client?.paymentProviderPayeeId
  const hasProvider = !!company?.hasPaymentProvider

  const previewClient = invoice.client
    ? {
        id: invoice.clientId,
        fantasyName: invoice.client.fantasyName,
        company: invoice.client.company,
        email: invoice.client.email,
        address: invoice.client.address,
        country: invoice.client.country,
        countryCode: invoice.client.countryCode,
        phone: null,
        website: null,
        notes: null,
        currency: invoice.currency,
        status: 'active' as const,
        contacts: [],
        paymentProviderPayeeId: null,
        autoSendDay: null,
        createdAt: '',
        updatedAt: '',
      }
    : null

  return (
    <div className="container mx-auto max-w-5xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/invoices')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{invoice.invoiceNumber}</h1>
            <InvoiceStatusBadge status={invoice.status} />
            {invoice.paymentProviderStatus && (
              <Badge variant="outline" className="capitalize">
                {invoice.paymentProviderStatus}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">{invoice.client.fantasyName}</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button variant="outline" onClick={() => navigate(`/invoices/${id}/edit`)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {canSend && (
            <Button onClick={() => setDialogAction('send')}>Mark as Sent</Button>
          )}
          {canPay && (
            <Button onClick={() => setDialogAction('pay')}>Mark as Paid</Button>
          )}
          {canCancel && (
            <Button variant="destructive" onClick={() => setDialogAction('cancel')}>
              Cancel
            </Button>
          )}
          {canSendViaProvider && (
            <span
              title={
                !hasProvider
                  ? 'Payment provider not configured — go to Company Settings'
                  : !hasPayeeId
                    ? 'Client has no Payment Platform ID configured'
                    : undefined
              }
            >
              <Button
                variant="outline"
                onClick={() => sendToProviderMutation.mutate()}
                disabled={!hasPayeeId || !hasProvider || sendToProviderMutation.isPending}
              >
                <Send className="mr-2 h-4 w-4" />
                {sendToProviderMutation.isPending ? 'Sending...' : 'Send via Payment Platform'}
              </Button>
            </span>
          )}
          <Button
            variant="outline"
            onClick={() => invoicesApi.downloadPdf(id!, invoice.invoiceNumber)}
          >
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Preview */}
      <InvoicePreview
        company={company ?? null}
        client={previewClient}
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

      {/* Status change dialog */}
      {dialogAction && (
        <StatusChangeDialog
          open={!!dialogAction}
          onOpenChange={(open) => !open && setDialogAction(null)}
          action={dialogAction}
          onConfirm={() => statusMutation.mutate(dialogAction)}
          isPending={statusMutation.isPending}
        />
      )}
    </div>
  )
}
