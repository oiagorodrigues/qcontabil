# CRM Clients Tasks

**Design**: `.specs/features/crm-clients/design.md`
**Status**: Draft

---

## Execution Plan

```
Phase 1: Shared (Sequential — foundation for both backend and frontend)
  T1 → T2

Phase 2: Backend (Sequential — entities → service → controller → module)
  T3 → T4 → T5 → T6

Phase 3: Shared UI (Parallel — DataTable components are independent)
  T7 → T8, T9, T10 [P]

Phase 4: Frontend Feature (Mixed — API first, then pages)
  T11 → T12 [P], T13
  T12, T13 → T14 → T15 → T16

Phase 5: Integration (Sequential)
  T17 → T18

Phase 6: Tests (Parallel after integration)
  T19, T20 [P]
```

```
T1 ─→ T2 ─→ T3 ─→ T4 ─→ T5 ─→ T6 ─┐
                                       │
T7 ─→ T8 ─┐                           │
      T9  ─┤ [P]                       │
      T10 ─┘                           │
                                       ▼
T11 ─→ T12 ─┐                        T17 ─→ T18
       T13 ─┤
             ▼
            T14 ─→ T15 ─→ T16 ──────→ T17
                                       ▼
                                 T19, T20 [P]
```

---

## Task Breakdown

### Phase 1: Shared (Foundation)

### T1: Create Zod schemas for clients

**What**: Zod schemas + enums for client/contact validation (shared between frontend and backend)
**Where**: `packages/shared/src/schemas/clients.ts`
**Depends on**: None
**Reuses**: Pattern from `packages/shared/src/schemas/auth.ts`
**Requirement**: R01, R02, R04

**Done when**:
- [ ] `clientStatusEnum` and `currencyEnum` Zod enums exported
- [ ] `contactSchema` validates name, email, phone?, role?, isPrimary
- [ ] `createClientSchema` validates all client fields + contacts array (min 1, exactly 1 primary via refine)
- [ ] `updateClientSchema` matches createClientSchema (PUT full replace)
- [ ] `listClientsQuerySchema` validates search?, status?, country?, sort?, page, limit
- [ ] All input types exported via `z.infer`
- [ ] No TypeScript errors: `pnpm --filter shared build`

**Verify**: `cd packages/shared && pnpm build`

**Commit**: `feat(shared): add Zod schemas and types for CRM clients`

---

### T2: Create response types for clients

**What**: Manual TypeScript types for API responses (not derived from Zod — these are server output types)
**Where**: `packages/shared/src/types/clients.ts` + update `packages/shared/src/index.ts`
**Depends on**: T1 (needs enum types)
**Reuses**: Pattern from `packages/shared/src/types/auth.ts`
**Requirement**: R02, R03

**Done when**:
- [ ] `ClientSummary` type defined (id, fantasyName, company, country, countryCode, currency, status, primaryContactName, primaryContactEmail, createdAt)
- [ ] `ClientDetail` type defined (full client fields + contacts array)
- [ ] `ContactResponse` type defined (id, name, email, phone, role, isPrimary)
- [ ] All types + schemas re-exported from `packages/shared/src/index.ts`
- [ ] No TypeScript errors: `pnpm --filter shared build`

**Verify**: `cd packages/shared && pnpm build`

**Commit**: `feat(shared): add CRM client response types`

---

### Phase 2: Backend

### T3: Create Client and Contact entities

**What**: TypeORM entities for clients and contacts tables
**Where**: `packages/api/src/clients/entities/client.entity.ts`, `packages/api/src/clients/entities/contact.entity.ts`
**Depends on**: T1 (enum values must match)
**Reuses**: Pattern from `packages/api/src/auth/entities/user.entity.ts`
**Requirement**: R01, R06

**Done when**:
- [ ] Client entity with all columns from design, including comments on every @Column (except id)
- [ ] Contact entity with all columns from design, including comments
- [ ] Relations: Client ManyToOne User (CASCADE), Client OneToMany Contact (cascade: true), Contact ManyToOne Client (CASCADE)
- [ ] Enum values match Zod enums from T1
- [ ] No TypeScript errors: `pnpm --filter api build`

**Verify**: `cd packages/api && pnpm build`

**Commit**: `feat(api): add Client and Contact TypeORM entities`

---

### T4: Create ClientsService

**What**: Business logic service for CRUD operations with user isolation
**Where**: `packages/api/src/clients/clients.service.ts`
**Depends on**: T3
**Reuses**: Pattern from `packages/api/src/auth/auth.service.ts` (Injectable, InjectRepository)
**Requirement**: R01, R02, R03, R04, R05, R06

**Done when**:
- [ ] `create(userId, dto)` — creates client + contacts in transaction, returns client with contacts
- [ ] `findAll(userId, query)` — paginated list with ILIKE search (fantasyName OR company), status filter, country filter, sort param, returns PaginatedResponse<ClientSummary>
- [ ] `findOne(userId, clientId)` — returns client with contacts, throws NotFoundException if not found or wrong user
- [ ] `update(userId, clientId, dto)` — updates client + delete-all/re-insert contacts in transaction, ownership check
- [ ] `remove(userId, clientId)` — deletes client (cascade contacts), ownership check
- [ ] All methods filter by userId (isolation)
- [ ] 404 (not 403) for wrong user's client
- [ ] No TypeScript errors: `pnpm --filter api build`

**Verify**: `cd packages/api && pnpm build`

**Commit**: `feat(api): add ClientsService with CRUD and user isolation`

---

### T5: Create ClientsController

**What**: REST endpoints wiring controller to service with validation
**Where**: `packages/api/src/clients/clients.controller.ts`
**Depends on**: T4, T1 (schemas for validation)
**Reuses**: Pattern from `packages/api/src/auth/auth.controller.ts` (@CurrentUser, ZodValidationPipe, @UsePipes)
**Requirement**: R01, R02, R03, R04, R05

**Done when**:
- [ ] `POST /clients` — creates client, uses ZodValidationPipe(createClientSchema), returns 201
- [ ] `GET /clients` — lists clients with query params, uses ZodValidationPipe(listClientsQuerySchema) on @Query
- [ ] `GET /clients/:id` — returns client detail with contacts
- [ ] `PUT /clients/:id` — updates client, uses ZodValidationPipe(updateClientSchema)
- [ ] `DELETE /clients/:id` — deletes client, returns 204
- [ ] All endpoints use @CurrentUser() for userId injection
- [ ] No @Public() — all protected by global guard
- [ ] No TypeScript errors: `pnpm --filter api build`

**Verify**: `cd packages/api && pnpm build`

**Commit**: `feat(api): add ClientsController with CRUD endpoints`

---

### T6: Create ClientsModule and register in AppModule

**What**: NestJS module wiring + registration in root module
**Where**: `packages/api/src/clients/clients.module.ts`, `packages/api/src/app.module.ts` (modify)
**Depends on**: T5
**Reuses**: Pattern from `packages/api/src/auth/auth.module.ts`
**Requirement**: R01-R06

**Done when**:
- [ ] ClientsModule imports TypeOrmModule.forFeature([Client, Contact])
- [ ] ClientsModule declares ClientsController and ClientsService
- [ ] AppModule imports ClientsModule
- [ ] App builds: `pnpm --filter api build`
- [ ] App starts without errors (entities auto-synced to DB)

**Verify**: `cd packages/api && pnpm build`

**Commit**: `feat(api): register ClientsModule in AppModule`

---

### Phase 3: Shared UI (DataTable)

### T7: Install shadcn/ui components + @tanstack/react-table

**What**: Install all new UI dependencies needed for DataTable and client feature
**Where**: `packages/web/`
**Depends on**: None (can start in parallel with Phase 2)
**Requirement**: R02

**Done when**:
- [ ] `@tanstack/react-table` installed in web package
- [ ] shadcn/ui components added: table, select, badge, textarea, separator, dropdown-menu, alert-dialog
- [ ] No build errors: `pnpm --filter web build`

**Verify**: `cd packages/web && pnpm build`

**Commit**: `feat(web): install DataTable dependencies and shadcn/ui components`

---

### T8: Create DataTable component

**What**: Generic DataTable component wrapping TanStack Table + shadcn table with server-side pagination/sorting
**Where**: `packages/web/src/components/data-table/DataTable.tsx`
**Depends on**: T7
**Reuses**: shadcn/ui `table` (Table, TableHeader, TableBody, TableRow, TableHead, TableCell)
**Requirement**: R02

**Done when**:
- [ ] Generic `DataTable<TData>` component with props per design API
- [ ] `manualPagination: true`, `manualSorting: true` configured
- [ ] Renders table headers with flexRender
- [ ] Renders table body rows with flexRender
- [ ] Supports `onRowClick` via row click handler
- [ ] Shows `emptyState` when no data
- [ ] Shows loading state when `isLoading`
- [ ] Renders `toolbar` slot above table
- [ ] Includes DataTablePagination at bottom
- [ ] No TypeScript errors

**Verify**: `cd packages/web && pnpm build`

**Commit**: `feat(web): add generic DataTable component with server-side pagination and sorting`

---

### T9: Create DataTableColumnHeader component [P]

**What**: Sortable column header with sort direction indicator
**Where**: `packages/web/src/components/data-table/DataTableColumnHeader.tsx`
**Depends on**: T7
**Reuses**: shadcn/ui `button`, lucide-react icons
**Requirement**: R02

**Done when**:
- [ ] Generic component accepting `column` and `title` props
- [ ] Clickable header toggles sorting (asc → desc → none)
- [ ] Shows sort direction icon (ArrowUp/ArrowDown/ArrowUpDown)
- [ ] Non-sortable columns render plain text
- [ ] No TypeScript errors

**Verify**: `cd packages/web && pnpm build`

**Commit**: `feat(web): add DataTableColumnHeader with sorting support`

---

### T10: Create DataTablePagination component [P]

**What**: Pagination controls with page info and page size selector
**Where**: `packages/web/src/components/data-table/DataTablePagination.tsx`
**Depends on**: T7
**Reuses**: shadcn/ui `button`, `select`
**Requirement**: R02

**Done when**:
- [ ] Shows "Page X of Y" text
- [ ] Previous/Next buttons (disabled at boundaries)
- [ ] Page size selector (10, 20, 50)
- [ ] Shows total row count
- [ ] No TypeScript errors

**Verify**: `cd packages/web && pnpm build`

**Commit**: `feat(web): add DataTablePagination component`

---

### Phase 4: Frontend Feature

### T11: Create clients API service

**What**: HTTP service layer for client CRUD operations
**Where**: `packages/web/src/features/clients/api/clients.api.ts`
**Depends on**: T2 (response types)
**Reuses**: Pattern from `packages/web/src/features/auth/api/auth.api.ts`, httpClient
**Requirement**: R01-R05

**Done when**:
- [ ] `clientsApi.create(data)` — POST /clients
- [ ] `clientsApi.list(params)` — GET /clients with query params
- [ ] `clientsApi.get(id)` — GET /clients/:id
- [ ] `clientsApi.update(id, data)` — PUT /clients/:id
- [ ] `clientsApi.remove(id)` — DELETE /clients/:id
- [ ] All methods properly typed with shared types
- [ ] No TypeScript errors

**Verify**: `cd packages/web && pnpm build`

**Commit**: `feat(web): add clients API service layer`

---

### T12: Create ClientStatusBadge and DeleteClientDialog components [P]

**What**: Reusable UI components for client status display and delete confirmation
**Where**: `packages/web/src/features/clients/components/ClientStatusBadge.tsx`, `packages/web/src/features/clients/components/DeleteClientDialog.tsx`
**Depends on**: T7 (shadcn badge, alert-dialog), T11 (delete mutation)
**Requirement**: R02, R05

**Done when**:
- [ ] ClientStatusBadge renders colored badge per status (active=green, inactive=gray, churned=red)
- [ ] DeleteClientDialog shows alert-dialog with client name, confirm/cancel actions
- [ ] DeleteClientDialog calls onConfirm callback (mutation handled by parent)
- [ ] No TypeScript errors

**Verify**: `cd packages/web && pnpm build`

**Commit**: `feat(web): add ClientStatusBadge and DeleteClientDialog components`

---

### T13: Create ContactsFieldArray component [P]

**What**: Dynamic form array for managing contacts within client form
**Where**: `packages/web/src/features/clients/components/ContactsFieldArray.tsx`
**Depends on**: T7 (shadcn input, button)
**Reuses**: TanStack Form field array API
**Requirement**: R01, R04

**Done when**:
- [ ] Renders list of contact rows (name, email, phone, role, isPrimary toggle)
- [ ] "Add contact" button adds new empty row
- [ ] Remove button (X) removes a row (disabled if only 1 contact left)
- [ ] Primary toggle (star icon) — clicking sets that contact as primary and unsets others
- [ ] At least 1 contact always present
- [ ] No TypeScript errors

**Verify**: `cd packages/web && pnpm build`

**Commit**: `feat(web): add ContactsFieldArray dynamic form component`

---

### T14: Create ClientForm component

**What**: Shared form for create and edit client, with company data + contacts sub-form
**Where**: `packages/web/src/features/clients/components/ClientForm.tsx`
**Depends on**: T13, T1 (Zod schemas for validation)
**Reuses**: TanStack Form + Zod, shadcn/ui (input, select, textarea, button, label), pattern from auth pages
**Requirement**: R01, R04

**Done when**:
- [ ] Form sections: Company info (fantasyName, company, country, countryCode, email, phone, website, address, notes, currency, status) + Contacts (via ContactsFieldArray)
- [ ] Validates against createClientSchema (Zod)
- [ ] Props: `defaultValues?`, `onSubmit`, `isSubmitting`
- [ ] Field-level error display
- [ ] Submit button with loading state
- [ ] No TypeScript errors

**Verify**: `cd packages/web && pnpm build`

**Commit**: `feat(web): add ClientForm component with validation`

---

### T15: Create ClientsListPage

**What**: Main clients page with DataTable, search, filters, and pagination
**Where**: `packages/web/src/features/clients/pages/ClientsListPage.tsx`
**Depends on**: T8, T9, T10, T11, T12
**Reuses**: DataTable, DataTableColumnHeader, ClientStatusBadge, DeleteClientDialog, TanStack Query
**Requirement**: R02, R05

**Done when**:
- [ ] Column definitions: fantasyName, company, country, currency, status (badge), primaryContact, actions (dropdown: edit/delete)
- [ ] Toolbar: search input (debounced 300ms), status filter select, country filter select, "New client" button
- [ ] Server-side pagination (10/page) via URL search params
- [ ] Server-side sorting via URL search params (default: fantasyName:asc)
- [ ] Empty state with CTA "Add your first client"
- [ ] Row click navigates to detail page
- [ ] Delete action shows confirmation dialog + mutation
- [ ] No TypeScript errors

**Verify**: `cd packages/web && pnpm build`

**Commit**: `feat(web): add ClientsListPage with DataTable`

---

### T16: Create ClientDetailPage, CreateClientPage, EditClientPage

**What**: Remaining client pages — detail view, create form, edit form
**Where**: `packages/web/src/features/clients/pages/ClientDetailPage.tsx`, `CreateClientPage.tsx`, `EditClientPage.tsx`
**Depends on**: T14, T11, T12
**Reuses**: ClientForm, ClientStatusBadge, DeleteClientDialog, TanStack Query, shadcn/ui (card, separator)
**Requirement**: R01, R03, R04, R05

**Done when**:
- [ ] **ClientDetailPage**: Shows full client info + contacts list + empty "Invoices" section. Edit/Delete action buttons. Fetches via `clientsApi.get(id)`
- [ ] **CreateClientPage**: ClientForm with create mutation. Redirects to detail on success. Title: "New Client"
- [ ] **EditClientPage**: ClientForm pre-filled with existing data (fetched). Update mutation. Redirects to detail on success. Title: "Edit Client"
- [ ] All pages handle loading and error states
- [ ] No TypeScript errors

**Verify**: `cd packages/web && pnpm build`

**Commit**: `feat(web): add client detail, create, and edit pages`

---

### Phase 5: Integration

### T17: Wire routes and navigation

**What**: Add client routes to router and navigation links
**Where**: `packages/web/src/app/router.tsx` (modify)
**Depends on**: T15, T16
**Requirement**: R01-R05

**Done when**:
- [ ] Routes added inside ProtectedRoute: /clients, /clients/new, /clients/:id, /clients/:id/edit
- [ ] All pages lazy loaded (same pattern as auth pages)
- [ ] Navigation from dashboard to clients exists (link or sidebar)
- [ ] No TypeScript errors
- [ ] App builds: `pnpm --filter web build`

**Verify**: `cd packages/web && pnpm build`

**Commit**: `feat(web): add client routes and navigation`

---

### T18: End-to-end smoke test (manual)

**What**: Verify full flow works: create client → list → detail → edit → delete
**Where**: Running app (docker-compose up + pnpm dev)
**Depends on**: T6, T17

**Done when**:
- [ ] Can create a client with contacts via form
- [ ] Client appears in list with correct data
- [ ] Search, filters, sorting, pagination work
- [ ] Detail page shows all data + contacts + empty invoices section
- [ ] Edit updates client and contacts
- [ ] Delete removes client with confirmation
- [ ] Another user cannot see/edit/delete the client (404)

**Verify**: Manual test in browser

**Commit**: No commit (verification only)

---

### Phase 6: Tests

### T19: Backend unit tests (ClientsService) [P]

**What**: Unit tests for ClientsService with mocked repositories
**Where**: `packages/api/src/clients/clients.service.spec.ts`
**Depends on**: T4
**Reuses**: Pattern from `packages/api/src/auth/auth.service.spec.ts`
**Requirement**: R01-R06

**Done when**:
- [ ] Tests for create: success, validation (no primary contact, empty contacts)
- [ ] Tests for findAll: returns paginated data, filters by search/status/country, sorting, user isolation
- [ ] Tests for findOne: success, not found, wrong user returns 404
- [ ] Tests for update: success, ownership check, contacts sync
- [ ] Tests for remove: success, ownership check
- [ ] All tests pass: `pnpm --filter api test:unit`

**Verify**: `cd packages/api && pnpm test:unit`

**Commit**: `test(api): add ClientsService unit tests`

---

### T20: Backend integration tests [P]

**What**: Integration tests for clients API endpoints with real DB
**Where**: `packages/api/test/clients/*.integration.ts`
**Depends on**: T6
**Reuses**: Pattern from `packages/api/test/auth/*.integration.ts`, test helpers (createTestApp, createVerifiedUser, loginAndGetCookies)
**Requirement**: R01-R06

**Done when**:
- [ ] POST /clients: success (201), validation errors (400), creates contacts
- [ ] GET /clients: returns paginated list, search works, filters work, sorting works, user isolation
- [ ] GET /clients/:id: success, 404 for non-existent, 404 for other user's client
- [ ] PUT /clients/:id: success, ownership check, contacts synced
- [ ] DELETE /clients/:id: success (204), ownership check, cascade contacts
- [ ] All tests pass: `pnpm --filter api test:integration`

**Verify**: `cd packages/api && pnpm test:integration`

**Commit**: `test(api): add clients integration tests`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1 ──→ T2

Phase 2 (Sequential, can start after T1):
  T3 ──→ T4 ──→ T5 ──→ T6

Phase 3 (Parallel, can start anytime):
  T7 ──→ T8
    ├──→ T9  [P]
    └──→ T10 [P]

Phase 4 (Mixed, after T2 + T7):
  T11 ──→ T12 [P]
     └──→ T13 [P]
            ├──→ T14 ──→ T15 ──→ T16

Phase 5 (Sequential, after Phase 2 + Phase 4):
  T17 ──→ T18

Phase 6 (Parallel, after Phase 2):
  T19 [P]
  T20 [P]
```

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Zod schemas | 1 file + enums | OK |
| T2: Response types | 1 file + exports | OK |
| T3: Entities | 2 files (cohesive) | OK |
| T4: Service | 1 file | OK |
| T5: Controller | 1 file | OK |
| T6: Module + register | 2 files (minimal) | OK |
| T7: Install deps | package.json | OK |
| T8: DataTable | 1 component | OK |
| T9: ColumnHeader | 1 component | OK |
| T10: Pagination | 1 component | OK |
| T11: API service | 1 file | OK |
| T12: Badge + Dialog | 2 small components (cohesive) | OK |
| T13: ContactsFieldArray | 1 component | OK |
| T14: ClientForm | 1 component | OK |
| T15: ClientsListPage | 1 page | OK |
| T16: Detail + Create + Edit pages | 3 pages (cohesive, simple) | OK — each is thin wrapper around ClientForm/detail |
| T17: Routes | 1 file modify | OK |
| T18: Smoke test | Manual | OK |
| T19: Unit tests | 1 test file | OK |
| T20: Integration tests | 1 test dir | OK |
