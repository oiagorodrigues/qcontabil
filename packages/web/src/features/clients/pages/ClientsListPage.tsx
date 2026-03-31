import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, SortingState, PaginationState } from '@tanstack/react-table'
import { MoreHorizontal, Plus } from 'lucide-react'
import type { ClientSummary, ClientStatus } from '@qcontabil/shared'
import { CLIENT_STATUSES } from '@qcontabil/shared'
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
import { clientsApi } from '../api/clients.api'
import { ClientStatusBadge } from '../components/ClientStatusBadge'
import { DeleteClientDialog } from '../components/DeleteClientDialog'

export default function ClientsListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const search = searchParams.get('search') || ''
  const statusFilter = (searchParams.get('status') || '') as ClientStatus | ''
  const countryFilter = searchParams.get('country') || ''
  const sortParam = searchParams.get('sort') || 'fantasyName:asc'
  const page = Number(searchParams.get('page') || '1')
  const limit = Number(searchParams.get('limit') || '10')

  const [searchInput, setSearchInput] = useState(search)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const [sortField, sortDir] = sortParam.split(':')
  const sorting: SortingState = sortField
    ? [{ id: sortField, desc: sortDir === 'desc' }]
    : []
  const pagination: PaginationState = { pageIndex: page - 1, pageSize: limit }

  const { data, isLoading } = useQuery({
    queryKey: ['clients', { search, status: statusFilter, country: countryFilter, sort: sortParam, page, limit }],
    queryFn: () =>
      clientsApi.list({ search: search || undefined, status: statusFilter || undefined, country: countryFilter || undefined, sort: sortParam, page, limit }),
    select: (res) => res.data,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setDeleteTarget(null)
    },
  })

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

  // Debounced search
  const searchTimeout = useMemo(() => {
    let timeout: ReturnType<typeof setTimeout>
    return (value: string) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => updateParams({ search: value || undefined }), 300)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const columns: ColumnDef<ClientSummary, unknown>[] = [
    {
      accessorKey: 'fantasyName',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.fantasyName}</div>
          <div className="text-muted-foreground text-sm">{row.original.company}</div>
        </div>
      ),
    },
    {
      accessorKey: 'country',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Country" />,
      cell: ({ row }) => (
        <span>
          {row.original.country} ({row.original.countryCode})
        </span>
      ),
    },
    {
      accessorKey: 'currency',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Currency" />,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => <ClientStatusBadge status={row.original.status} />,
    },
    {
      id: 'primaryContact',
      header: 'Primary Contact',
      cell: ({ row }) => (
        <div>
          <div className="text-sm">{row.original.primaryContactName}</div>
          <div className="text-muted-foreground text-xs">{row.original.primaryContactEmail}</div>
        </div>
      ),
      enableSorting: false,
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
                navigate(`/clients/${row.original.id}/edit`)
              }}
            >
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                setDeleteTarget({ id: row.original.id, name: row.original.fantasyName })
              }}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      enableSorting: false,
    },
  ]

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Clients</h1>
        <Button onClick={() => navigate('/clients/new')}>
          <Plus className="mr-2 h-4 w-4" />
          New Client
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
        onRowClick={(row) => navigate(`/clients/${row.id}`)}
        isLoading={isLoading}
        toolbar={
          <div className="flex items-center gap-4">
            <Input
              placeholder="Search clients..."
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value)
                searchTimeout(e.target.value)
              }}
              className="max-w-xs"
            />
            <Select
              value={statusFilter}
              onValueChange={(value) => updateParams({ status: value === 'all' ? undefined : value })}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {CLIENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        emptyState={
          <div className="py-8 text-center">
            <p className="text-muted-foreground mb-4">No clients yet</p>
            <Button variant="outline" onClick={() => navigate('/clients/new')}>
              Add your first client
            </Button>
          </div>
        }
      />

      {deleteTarget && (
        <DeleteClientDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          clientName={deleteTarget.name}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  )
}
