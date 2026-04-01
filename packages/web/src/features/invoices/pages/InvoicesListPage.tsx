import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef, SortingState, PaginationState } from '@tanstack/react-table'
import { MoreHorizontal, Plus } from 'lucide-react'
import type { InvoiceSummary, InvoiceStatus, ClientSummary } from '@qcontabil/shared'
import { INVOICE_STATUSES } from '@qcontabil/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DataTable } from '@/components/data-table/DataTable'
import { DataTableColumnHeader } from '@/components/data-table/DataTableColumnHeader'
import { invoicesApi } from '../api/invoices.api'
import { clientsApi } from '@/features/clients/api/clients.api'
import { InvoiceStatusBadge } from '../components/InvoiceStatusBadge'

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  cancelled: 'Cancelled',
}

export default function InvoicesListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const search = searchParams.get('search') || ''
  const statusFilter = (searchParams.get('status') || '') as InvoiceStatus | ''
  const clientIdFilter = searchParams.get('clientId') || ''
  const sortParam = searchParams.get('sort') || 'issueDate:desc'
  const page = Number(searchParams.get('page') || '1')
  const limit = Number(searchParams.get('limit') || '10')

  const [searchInput, setSearchInput] = useState(search)

  const [sortField, sortDir] = sortParam.split(':')
  const sorting: SortingState = sortField ? [{ id: sortField, desc: sortDir === 'desc' }] : []
  const pagination: PaginationState = { pageIndex: page - 1, pageSize: limit }

  const { data, isLoading } = useQuery({
    queryKey: [
      'invoices',
      { search, status: statusFilter, clientId: clientIdFilter, sort: sortParam, page, limit },
    ],
    queryFn: () =>
      invoicesApi.list({
        search: search || undefined,
        status: statusFilter || undefined,
        clientId: clientIdFilter || undefined,
        sort: sortParam,
        page,
        limit,
      }),
    select: (res) => res.data,
  })

  const { data: clientsData } = useQuery({
    queryKey: ['clients', { limit: 100 }],
    queryFn: () => clientsApi.list({ limit: 100 }),
    select: (res) => res.data,
  })

  const clients: ClientSummary[] = clientsData?.data ?? []

  function updateParams(updates: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        next.set(key, value)
      } else {
        next.delete(key)
      }
    }
    if (!updates.page) next.set('page', '1')
    setSearchParams(next)
  }

  const searchTimeout = useMemo(() => {
    let timeout: ReturnType<typeof setTimeout>
    return (value: string) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => updateParams({ search: value || undefined }), 300)
    }
  }, [searchParams])

  function formatAmount(amount: number, currency: string): string {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
    } catch {
      return amount.toFixed(2)
    }
  }

  const columns: ColumnDef<InvoiceSummary, unknown>[] = [
    {
      accessorKey: 'invoiceNumber',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Invoice #" />,
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">{row.original.invoiceNumber}</span>
      ),
    },
    {
      id: 'client',
      header: 'Client',
      cell: ({ row }) => row.original.clientFantasyName,
      enableSorting: false,
    },
    {
      accessorKey: 'issueDate',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Issue Date" />,
    },
    {
      accessorKey: 'dueDate',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Due Date" />,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => <InvoiceStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'total',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatAmount(row.original.total, row.original.currency)}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/invoices/${row.original.id}`)
              }}
            >
              View
            </DropdownMenuItem>
            {row.original.status === 'draft' && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  navigate(`/invoices/${row.original.id}/edit`)
                }}
              >
                Edit
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      enableSorting: false,
    },
  ]

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Invoices</h1>
        <Button onClick={() => navigate('/invoices/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Invoice
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data || []}
        total={data?.total || 0}
        pagination={pagination}
        onPaginationChange={(updater) => {
          const next = typeof updater === 'function' ? updater(pagination) : updater
          updateParams({ page: String(next.pageIndex + 1), limit: String(next.pageSize) })
        }}
        sorting={sorting}
        onSortingChange={(updater) => {
          const next = typeof updater === 'function' ? updater(sorting) : updater
          if (next.length > 0) {
            updateParams({ sort: `${next[0].id}:${next[0].desc ? 'desc' : 'asc'}` })
          } else {
            updateParams({ sort: undefined })
          }
        }}
        onRowClick={(row) => navigate(`/invoices/${row.id}`)}
        isLoading={isLoading}
        toolbar={
          <div className="flex items-center gap-4">
            <Input
              placeholder="Search invoices..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value)
                searchTimeout(e.target.value)
              }}
              className="max-w-xs"
            />
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                updateParams({ status: value === 'all' ? undefined : value })
              }
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {INVOICE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={clientIdFilter}
              onValueChange={(value) =>
                updateParams({ clientId: value === 'all' ? undefined : value })
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.fantasyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        emptyState={
          <div className="py-8 text-center">
            <p className="text-muted-foreground mb-4">No invoices yet</p>
            <Button variant="outline" onClick={() => navigate('/invoices/new')}>
              Create your first invoice
            </Button>
          </div>
        }
      />
    </div>
  )
}
