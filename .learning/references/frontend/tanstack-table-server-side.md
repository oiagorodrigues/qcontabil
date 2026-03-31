# Generic DataTable with TanStack Table + shadcn/ui

## Context

Building a reusable DataTable component that works with server-side pagination and sorting, using TanStack Table (headless) + shadcn/ui `table` component.

## Architecture

```
components/data-table/
├── DataTable.tsx              # Main: wires useReactTable + shadcn Table
├── DataTableColumnHeader.tsx  # Sortable header with arrow icons
└── DataTablePagination.tsx    # Page controls + page size selector
```

## Key Configuration

```typescript
const table = useReactTable({
  data,
  columns,
  rowCount: total,          // server provides total count
  state: { pagination, sorting },
  onPaginationChange,       // controlled by parent via URL params
  onSortingChange,          // controlled by parent via URL params
  getCoreRowModel: getCoreRowModel(),
  manualPagination: true,   // server controls data slicing
  manualSorting: true,      // server controls ordering
})
```

## Consumer Pattern (ClientsListPage)

```typescript
// URL params as single source of truth
const [searchParams, setSearchParams] = useSearchParams()
const page = Number(searchParams.get('page') || '1')
const sortParam = searchParams.get('sort') || 'fantasyName:asc'

// TanStack Query synced with URL params
const { data } = useQuery({
  queryKey: ['clients', { search, status, sort: sortParam, page, limit }],
  queryFn: () => clientsApi.list({ sort: sortParam, page, limit }),
})

// Sort format: "field:asc|desc" — simple, parseable
<DataTable
  columns={columns}
  data={data?.data || []}
  total={data?.total || 0}
  pagination={{ pageIndex: page - 1, pageSize: limit }}
  onPaginationChange={(updater) => {
    const next = typeof updater === 'function' ? updater(pagination) : updater
    updateParams({ page: String(next.pageIndex + 1) })
  }}
  sorting={sorting}
  onSortingChange={(updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater
    updateParams({ sort: `${next[0].id}:${next[0].desc ? 'desc' : 'asc'}` })
  }}
/>
```

## Key Decisions

- **Server-side only**: no `getFilteredRowModel`, `getSortedRowModel`, `getPaginationRowModel`
- **Filters via toolbar slot** (`toolbar?: ReactNode`): each feature defines its own filters
- **URL as state**: pagination/sorting synced with `useSearchParams` for deep-linking
- **Sort format**: `field:asc|desc` query param — parseable, extensible to multi-sort
