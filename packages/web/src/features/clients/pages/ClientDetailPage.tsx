import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, Phone, Globe, MapPin, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loading } from '@/components/Loading'
import { clientsApi } from '../api/clients.api'
import { invoicesApi } from '@/features/invoices/api/invoices.api'
import { ClientStatusBadge } from '../components/ClientStatusBadge'
import { InvoiceStatusBadge } from '@/features/invoices/components/InvoiceStatusBadge'
import { DeleteClientDialog } from '../components/DeleteClientDialog'
import type { AxiosError } from 'axios'

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showDelete, setShowDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { data: client, isLoading } = useQuery({
    queryKey: ['clients', id],
    queryFn: () => clientsApi.get(id!),
    select: (res) => res.data,
    enabled: !!id,
  })

  const { data: clientInvoices } = useQuery({
    queryKey: ['invoices', 'by-client', id],
    queryFn: () => invoicesApi.listByClient(id!),
    select: (res) => res.data,
    enabled: !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: () => clientsApi.remove(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      navigate('/clients')
    },
    onError: (err: AxiosError<{ message?: string }>) => {
      setShowDelete(false)
      if (err.response?.status === 409) {
        setDeleteError(
          err.response.data?.message ||
            'Cannot delete client with existing invoices. Change status to inactive instead.',
        )
      }
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
    <div className="container mx-auto max-w-3xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{client.fantasyName}</h1>
          <p className="text-muted-foreground">{client.company}</p>
        </div>
        <div className="flex items-center gap-2">
          <ClientStatusBadge status={client.status} />
          <Button variant="outline" onClick={() => navigate(`/clients/${id}/edit`)}>
            Edit
          </Button>
          <Button variant="destructive" onClick={() => setShowDelete(true)}>
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <Mail className="text-muted-foreground h-4 w-4" />
            <span>{client.email}</span>
          </div>
          {client.phone && (
            <div className="flex items-center gap-2">
              <Phone className="text-muted-foreground h-4 w-4" />
              <span>{client.phone}</span>
            </div>
          )}
          {client.website && (
            <div className="flex items-center gap-2">
              <Globe className="text-muted-foreground h-4 w-4" />
              <span>{client.website}</span>
            </div>
          )}
          {client.address && (
            <div className="flex items-center gap-2 sm:col-span-2">
              <MapPin className="text-muted-foreground h-4 w-4 shrink-0" />
              <span>{client.address}</span>
            </div>
          )}
          <div>
            <span className="text-muted-foreground text-sm">Country</span>
            <p>
              {client.country} ({client.countryCode})
            </p>
          </div>
          <div>
            <span className="text-muted-foreground text-sm">Currency</span>
            <p>{client.currency}</p>
          </div>
          {client.notes && (
            <div className="sm:col-span-2">
              <span className="text-muted-foreground text-sm">Notes</span>
              <p className="whitespace-pre-wrap">{client.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {client.contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-start justify-between rounded-md border p-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{contact.name}</span>
                    {contact.isPrimary && (
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm">{contact.email}</p>
                  {contact.role && <p className="text-muted-foreground text-xs">{contact.role}</p>}
                </div>
                {contact.phone && (
                  <span className="text-muted-foreground text-sm">{contact.phone}</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Invoices</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/invoices/new?clientId=${id}`)}
          >
            Create invoice
          </Button>
        </CardHeader>
        <CardContent>
          {!clientInvoices || clientInvoices.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No invoices yet</p>
          ) : (
            <div className="space-y-2">
              {clientInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-md border p-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/invoices/${inv.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium tabular-nums">{inv.invoiceNumber}</span>
                    <InvoiceStatusBadge status={inv.status} />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{inv.issueDate}</span>
                    <span className="font-medium tabular-nums text-foreground">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: inv.currency }).format(inv.total)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {deleteError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{deleteError}</p>
          <Button
            variant="link"
            size="sm"
            className="mt-1 h-auto p-0 text-destructive"
            onClick={() => {
              setDeleteError(null)
              navigate(`/clients/${id}/edit`)
            }}
          >
            Change status to inactive
          </Button>
        </div>
      )}

      <DeleteClientDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        clientName={client.fantasyName}
        onConfirm={() => deleteMutation.mutate()}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  )
}
