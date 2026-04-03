# Dashboard — Tasks

**Design:** `design.md`
**Status:** READY

---

## Execution Plan

```
Phase 1 (Foundation):
  T1 (shared types+schemas)

Phase 2 (Backend — parallel):
  T1 complete, then:
    ├── T2 (DashboardService: summary + recent)  [P]
    ├── T3 (DashboardService: chart)              [P]
    └── T4 (DashboardService: top clients)        [P]

Phase 3 (Backend integration):
  T2, T3, T4 complete, then:
    T5 (DashboardController + Module)

Phase 4 (Frontend — parallel):
  T5 complete, then:
    ├── T6 (API client + hooks)      [P]
    ├── T7 (SummaryCards component)   [P]
    ├── T8 (RevenueChart component)   [P]
    ├── T9 (TopClientsTable)          [P]
    └── T10 (RecentInvoices)          [P]

Phase 5 (Frontend integration):
  T6-T10 complete, then:
    T11 (DashboardPage + filters + routing)

Phase 6 (Tests):
  T12 (backend tests)
```

---

## Task Breakdown

### T1 — Shared: types + schemas

**What:** Criar types de response do dashboard e schema de query params
**Where:**
- `packages/shared/src/types/dashboard.ts` (new)
- `packages/shared/src/schemas/dashboard.ts` (new)
- `packages/shared/src/index.ts` (update exports)
**Depends on:** None
**Requirement:** DSH-15, DSH-16, DSH-17

**Steps:**
1. Criar `types/dashboard.ts` com `DashboardPeriod`, `DashboardSummaryResponse`, `ChartDataPoint`, `DashboardChartResponse`, `TopClientEntry`, `DashboardTopClientsResponse`
2. Criar `schemas/dashboard.ts` com `dashboardPeriodSchema`, `dashboardQuerySchema`
3. Exportar tudo em `index.ts`

**Done when:**
- [ ] `pnpm --filter shared build` passa sem erros
- [ ] Types e schemas exportados corretamente

---

### T2 — Backend: DashboardService.getSummary()

**What:** Implementar query agregada para summary cards + recent invoices + available currencies
**Where:** `packages/api/src/dashboard/dashboard.service.ts` (new)
**Depends on:** T1
**Reuses:** Invoice entity (QueryBuilder), InvoiceSummary type
**Requirement:** DSH-01, DSH-02, DSH-03, DSH-04, DSH-05, DSH-07, DSH-08, DSH-09

**Steps:**
1. Criar `DashboardService` com injection de `DataSource`
2. Implementar helper `getDateRange(period)` que retorna `{ start, end }` e `{ prevStart, prevEnd }` para cálculo de % change
3. Implementar `getSummary(userId, period, currency?)`:
   - Query SUM(total) WHERE status IN ('sent','paid') + currency filter → totalBilled
   - Query SUM(total) WHERE status = 'sent' → totalPending
   - Query SUM(total) WHERE status = 'paid' → totalReceived
   - Query COUNT GROUP BY status → invoicesByStatus
   - Mesmas queries para período anterior → percentChange
   - Query top 5 recent invoices ORDER BY createdAt DESC
   - Query DISTINCT currency + COUNT → availableCurrencies + defaultCurrency
4. Retornar `DashboardSummaryResponse`

**Done when:**
- [ ] Método retorna dados corretos com mocks manuais (unit test)
- [ ] TypeScript compila sem erros

---

### T3 — Backend: DashboardService.getRevenueChart()

**What:** Implementar query para dados do gráfico de faturamento mensal
**Where:** `packages/api/src/dashboard/dashboard.service.ts` (update)
**Depends on:** T1
**Requirement:** DSH-12, DSH-16

**Steps:**
1. Implementar `getRevenueChart(userId, period, currency?)`:
   - Query SUM(total) WHERE status IN ('sent','paid') GROUP BY EXTRACT(YEAR, MONTH from issueDate)
   - Gerar labels (Jan, Fev, etc.) para cada mês no range
   - Preencher meses sem dados com total = 0

**Done when:**
- [ ] Retorna array de ChartDataPoint com meses corretos
- [ ] Meses sem invoices retornam total = 0

---

### T4 — Backend: DashboardService.getTopClients()

**What:** Implementar query para ranking de top 5 clientes por faturamento
**Where:** `packages/api/src/dashboard/dashboard.service.ts` (update)
**Depends on:** T1
**Requirement:** DSH-13, DSH-17

**Steps:**
1. Implementar `getTopClients(userId, period, currency?)`:
   - Query SUM(total) WHERE status IN ('sent','paid') GROUP BY clientId JOIN Client
   - ORDER BY total DESC LIMIT 5
   - Calcular grandTotal e percentage por client

**Done when:**
- [ ] Retorna top 5 clients com nome, total e percentage
- [ ] Percentage soma ~100% (pode ser < 100% se há mais de 5 clients)

---

### T5 — Backend: DashboardController + Module

**What:** Criar controller com 3 endpoints e module que wira tudo
**Where:**
- `packages/api/src/dashboard/dashboard.controller.ts` (new)
- `packages/api/src/dashboard/dashboard.module.ts` (new)
- `packages/api/src/app.module.ts` (update imports)
**Depends on:** T2, T3, T4
**Reuses:** ZodValidationPipe, @CurrentUser(), dashboardQuerySchema
**Requirement:** DSH-15, DSH-16, DSH-17, DSH-18

**Steps:**
1. Criar `DashboardController` com:
   - `GET /dashboard/summary` → `@Query(ZodValidationPipe(dashboardQuerySchema))` → service.getSummary()
   - `GET /dashboard/chart` → service.getRevenueChart()
   - `GET /dashboard/top-clients` → service.getTopClients()
2. Criar `DashboardModule` importando TypeOrmModule.forFeature([Invoice, Client])
3. Adicionar DashboardModule em app.module.ts

**Done when:**
- [ ] `pnpm --filter api build` compila sem erros
- [ ] Endpoints respondem com curl/httpie (manual test)

---

### T6 — Frontend: API client + TanStack Query hooks

**What:** Criar dashboard API client e hooks de data fetching
**Where:**
- `packages/web/src/features/dashboard/api/dashboard.api.ts` (new)
- `packages/web/src/features/dashboard/api/dashboard.hooks.ts` (new)
**Depends on:** T1 (shared types), T5 (endpoints existem)
**Reuses:** httpClient, useQuery pattern de invoices/clients
**Requirement:** DSH-15, DSH-16, DSH-17

**Steps:**
1. Criar `dashboard.api.ts` com funções: `getSummary(params)`, `getChart(params)`, `getTopClients(params)`
2. Criar `dashboard.hooks.ts` com hooks: `useDashboardSummary(params)`, `useDashboardChart(params)`, `useDashboardTopClients(params)`
3. Query keys: `['dashboard', 'summary', params]`, etc.

**Done when:**
- [ ] Hooks exportados com types corretos
- [ ] TypeScript compila sem erros

---

### T7 — Frontend: SummaryCards component

**What:** 4 cards (Total Faturado, Pendente, Recebido, Invoices) com variação percentual
**Where:** `packages/web/src/features/dashboard/components/SummaryCards.tsx` (new)
**Depends on:** T1 (types)
**Reuses:** Card component (ui/)
**Requirement:** DSH-01, DSH-02, DSH-03, DSH-04, DSH-05

**Steps:**
1. Criar `SummaryCards` que recebe `DashboardSummaryResponse`
2. 4 cards com: label, valor formatado (Intl.NumberFormat), badge de % change (verde/vermelho)
3. Card de invoices mostra breakdown por status

**Done when:**
- [ ] Componente renderiza sem erros com dados mock
- [ ] Valores formatados com moeda correta

---

### T8 — Frontend: RevenueChart component

**What:** Bar chart de faturamento mensal usando recharts
**Where:** `packages/web/src/features/dashboard/components/RevenueChart.tsx` (new)
**Depends on:** T1 (types)
**Requirement:** DSH-12

**Steps:**
1. Instalar recharts: `pnpm --filter web add recharts`
2. Criar `RevenueChart` com `ResponsiveContainer` + `BarChart` + `XAxis` + `YAxis` + `Tooltip` + `Bar`
3. XAxis: label do mês; YAxis: valor formatado; Tooltip: valor completo
4. Empty state quando não há dados

**Done when:**
- [ ] Chart renderiza com dados mock
- [ ] Responsivo (ResponsiveContainer width 100%)
- [ ] Empty state funciona

---

### T9 — Frontend: TopClientsTable component

**What:** Tabela simples com top 5 clientes por faturamento
**Where:** `packages/web/src/features/dashboard/components/TopClientsTable.tsx` (new)
**Depends on:** T1 (types)
**Reuses:** Card component
**Requirement:** DSH-13

**Steps:**
1. Criar `TopClientsTable` que recebe `DashboardTopClientsResponse`
2. Tabela com colunas: #, Cliente, Total, %
3. Link no nome do cliente para `/clients/:id`
4. Empty state

**Done when:**
- [ ] Tabela renderiza com dados mock
- [ ] Links funcionam

---

### T10 — Frontend: RecentInvoices component

**What:** Lista dos 5 invoices mais recentes com status badge e link
**Where:** `packages/web/src/features/dashboard/components/RecentInvoices.tsx` (new)
**Depends on:** T1 (types)
**Reuses:** StatusBadge, Card
**Requirement:** DSH-09, DSH-10, DSH-11

**Steps:**
1. Criar `RecentInvoices` que recebe `InvoiceSummary[]`
2. Cada item: invoice number, client name, status badge, total, date
3. Click → navigate to `/invoices/:id`
4. Link "Ver todos" → `/invoices`
5. Empty state

**Done when:**
- [ ] Lista renderiza com dados mock
- [ ] Links funcionam
- [ ] StatusBadge reutilizado corretamente

---

### T11 — Frontend: DashboardPage + filters + routing

**What:** Page principal com filtros de período/moeda, composição de todos os componentes, e rota `/`
**Where:**
- `packages/web/src/features/dashboard/pages/DashboardPage.tsx` (new or replace stub)
- `packages/web/src/features/dashboard/components/DashboardFilters.tsx` (new)
- `packages/web/src/app/router.tsx` (update — replace lazy stub)
**Depends on:** T6, T7, T8, T9, T10
**Reuses:** Select component (ui/), existing router pattern
**Requirement:** DSH-06, DSH-07, DSH-08, DSH-09-a, DSH-19, DSH-20

**Steps:**
1. Criar `DashboardFilters` com Select para período e moeda
2. Criar `DashboardPage`:
   - useState para period (default 'month') e currency
   - useDashboardSummary, useDashboardChart, useDashboardTopClients com params
   - Layout: Filters → SummaryCards → Row(RevenueChart | TopClientsTable) → RecentInvoices
3. Atualizar router — garantir que `/` aponta para DashboardPage
4. Loading states e error handling

**Done when:**
- [ ] Dashboard renderiza com dados reais da API
- [ ] Filtros atualizam os dados
- [ ] Rota `/` carrega o dashboard
- [ ] Loading skeleton enquanto carrega

---

### T12 — Testes

**What:** Unit tests do DashboardService e integration tests dos endpoints
**Where:**
- `packages/api/src/dashboard/dashboard.service.spec.ts` (new)
- `packages/api/test/dashboard/` (new integration tests)
**Depends on:** T5
**Requirement:** DSH-15, DSH-16, DSH-17, DSH-18

**Steps:**
1. Unit test: `getSummary()` retorna zeros quando não há invoices
2. Unit test: `getRevenueChart()` retorna meses corretos para cada período
3. Unit test: `getTopClients()` ordena por total DESC e calcula percentages
4. Unit test: `getDateRange()` calcula ranges corretos para cada período
5. Integration test: `GET /dashboard/summary` retorna 200 com shape correto
6. Integration test: `GET /dashboard/summary?currency=USD` filtra por moeda
7. Integration test: endpoints retornam 401 sem auth

**Done when:**
- [ ] `pnpm --filter api test:unit` passa
- [ ] `pnpm --filter api test:integration` passa

---

## Dependency Graph

```
T1 (shared types/schemas)
├── T2 (service: summary)     [P]
├── T3 (service: chart)       [P]
└── T4 (service: top clients) [P]
    └── T5 (controller + module)
        ├── T6 (frontend API + hooks)  [P]
        ├── T7 (SummaryCards)          [P]
        ├── T8 (RevenueChart)          [P]
        ├── T9 (TopClientsTable)       [P]
        └── T10 (RecentInvoices)       [P]
            └── T11 (DashboardPage + filters + routing)
                └── T12 (tests)
```
