# Dashboard Design

**Spec**: `spec.md`
**Status**: Draft

---

## Architecture Overview

Backend: 1 module (`DashboardModule`) com 1 controller e 1 service. Queries agregadas direto no DB via TypeORM QueryBuilder (SUM, COUNT, GROUP BY). Sem entity nova — lê de `Invoice` e `Client`.

Frontend: 1 page com componentes de cards, chart (recharts), tabela de top clients, e lista de invoices recentes. Filtros de período e moeda via query params locais (Zustand ou useState).

```
Browser                          API
┌─────────────────────┐     ┌────────────────────────┐
│ DashboardPage       │     │ DashboardController    │
│ ├─ PeriodFilter     │────>│ GET /dashboard/summary │
│ ├─ CurrencyFilter   │────>│ GET /dashboard/chart   │
│ ├─ SummaryCards     │────>│ GET /dashboard/top     │
│ ├─ RevenueChart     │     │                        │
│ ├─ TopClientsTable  │     │ DashboardService       │
│ └─ RecentInvoices   │     │ ├─ getSummary()        │
└─────────────────────┘     │ ├─ getRevenueChart()   │
                            │ ├─ getTopClients()     │
                            │ └─ getRecentInvoices() │
                            └────────────────────────┘
```

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
|-----------|----------|------------|
| Invoice entity | `api/src/invoices/entities/invoice.entity.ts` | Query source — SUM(total), COUNT, GROUP BY |
| Client entity | `api/src/clients/entities/client.entity.ts` | JOIN for top clients table |
| Currency enum | `shared/src/schemas/clients.ts` | Reuse `currencySchema` for filter validation |
| InvoiceSummary type | `shared/src/types/invoices.ts` | Reuse for recent invoices list |
| StatusBadge | `web/src/features/invoices/` | Reuse invoice status badge component |
| DataTable | `web/src/components/data-table/` | Reuse for top clients table |
| Card component | `web/src/components/ui/card.tsx` | Summary cards |
| httpClient | `web/src/lib/http-client.ts` | API calls |

### Integration Points

| System | Integration Method |
|--------|-------------------|
| Invoice table | QueryBuilder aggregations (no new entities) |
| Client table | JOIN for client names in top clients |
| Auth | `@CurrentUser()` — filter by userId |

---

## Components

### Backend: DashboardController

- **Purpose**: Expose dashboard endpoints
- **Location**: `packages/api/src/dashboard/dashboard.controller.ts`
- **Endpoints**:
  - `GET /dashboard/summary?period=month|quarter|year|last12&currency=USD` → `DashboardSummaryResponse`
  - `GET /dashboard/chart?period=...&currency=...` → `DashboardChartResponse`
  - `GET /dashboard/top-clients?period=...&currency=...` → `DashboardTopClientsResponse`
- **Dependencies**: DashboardService, `@CurrentUser()`
- **Reuses**: ZodValidationPipe for query validation

### Backend: DashboardService

- **Purpose**: Aggregate invoice data for dashboard metrics
- **Location**: `packages/api/src/dashboard/dashboard.service.ts`
- **Methods**:
  - `getSummary(userId, period, currency)` → summary cards + recent invoices
  - `getRevenueChart(userId, period, currency)` → monthly revenue data
  - `getTopClients(userId, period, currency)` → top 5 clients
  - `getAvailableCurrencies(userId)` → list of currencies used + most frequent
- **Dependencies**: TypeORM `DataSource` (QueryBuilder)
- **Reuses**: Invoice entity, Client entity

### Frontend: DashboardPage

- **Purpose**: Main dashboard page — orchestrates data fetching and layout
- **Location**: `packages/web/src/features/dashboard/pages/DashboardPage.tsx`
- **Dependencies**: All dashboard components, TanStack Query hooks
- **Reuses**: Existing page layout pattern

### Frontend: SummaryCards

- **Purpose**: 4 cards — Total Faturado, Pendente, Recebido, Invoices count
- **Location**: `packages/web/src/features/dashboard/components/SummaryCards.tsx`
- **Props**: `data: DashboardSummaryResponse`
- **Reuses**: Card component from ui/

### Frontend: RevenueChart

- **Purpose**: Bar chart showing monthly revenue
- **Location**: `packages/web/src/features/dashboard/components/RevenueChart.tsx`
- **Props**: `data: ChartDataPoint[]`
- **Dependencies**: recharts (`BarChart`, `ResponsiveContainer`, `XAxis`, `YAxis`, `Tooltip`, `Bar`)
- **Reuses**: Card for wrapper

### Frontend: TopClientsTable

- **Purpose**: Table with top 5 clients by revenue
- **Location**: `packages/web/src/features/dashboard/components/TopClientsTable.tsx`
- **Props**: `data: TopClientEntry[]`
- **Reuses**: Card, basic table (not DataTable — too simple for full table)

### Frontend: RecentInvoices

- **Purpose**: List of 5 most recent invoices with links
- **Location**: `packages/web/src/features/dashboard/components/RecentInvoices.tsx`
- **Props**: `data: InvoiceSummary[]`
- **Reuses**: StatusBadge, Card

### Frontend: DashboardFilters

- **Purpose**: Period + Currency filter controls
- **Location**: `packages/web/src/features/dashboard/components/DashboardFilters.tsx`
- **Props**: `period, currency, currencies[], onChange`
- **Reuses**: Select component from ui/

---

## Data Models

### Shared Types (new)

```typescript
// packages/shared/src/types/dashboard.ts

type DashboardPeriod = 'month' | 'quarter' | 'year' | 'last12'

interface DashboardSummaryResponse {
  totalBilled: number      // sent + paid
  totalPending: number     // sent only
  totalReceived: number    // paid only
  invoiceCount: number
  invoicesByStatus: { draft: number; sent: number; paid: number; cancelled: number }
  percentChange: {         // vs previous period
    totalBilled: number | null
    totalPending: number | null
    totalReceived: number | null
  }
  recentInvoices: InvoiceSummary[]  // top 5
  availableCurrencies: string[]
  defaultCurrency: string
}

interface ChartDataPoint {
  month: string    // "2026-01", "2026-02", etc.
  label: string    // "Jan", "Feb", etc.
  total: number
}

interface DashboardChartResponse {
  data: ChartDataPoint[]
}

interface TopClientEntry {
  clientId: string
  clientName: string
  total: number
  percentage: number  // % of grand total
}

interface DashboardTopClientsResponse {
  data: TopClientEntry[]
  grandTotal: number
}
```

### Shared Schemas (new)

```typescript
// packages/shared/src/schemas/dashboard.ts

const dashboardPeriodSchema = z.enum(['month', 'quarter', 'year', 'last12'])

const dashboardQuerySchema = z.object({
  period: dashboardPeriodSchema.default('month'),
  currency: z.string().length(3).optional(),  // ISO 4217
})

type DashboardQuery = z.infer<typeof dashboardQuerySchema>
```

---

## Period Calculation Logic

| Period | Start Date | End Date |
|--------|-----------|----------|
| `month` | 1st of current month | Last day of current month |
| `quarter` | 1st of current quarter | Last day of current quarter |
| `year` | Jan 1st of current year | Dec 31st of current year |
| `last12` | Today minus 12 months | Today |

**Previous period** (for % change): same duration shifted back by 1 unit (e.g., month → previous month, quarter → previous quarter).

**Chart months**: `month` → 1 bar (current month), `quarter` → 3 bars, `year` → 12 bars, `last12` → 12 bars.

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
|----------------|----------|-------------|
| No invoices in period | Return zeros | Cards show 0, chart empty state |
| No invoices at all | Return zeros + empty currencies | Show "Create your first invoice" CTA |
| Invalid period param | Zod validation → 400 | Toast error |

---

## Tech Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Chart library | recharts | Lightweight, React-native, composable, popular |
| Query approach | TypeORM QueryBuilder | Raw aggregations (SUM, COUNT, GROUP BY) — no ORM overhead |
| Single endpoint for summary + recent | Combined in getSummary() | Reduces HTTP calls, data is co-located |
| Filter state | useState (local) | Simple enough — no need for Zustand store |
| Currency filter default | Most frequent currency from user's invoices | Better UX for single-currency contractors |
