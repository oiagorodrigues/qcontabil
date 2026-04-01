# Invoice Generation Tasks

**Design**: `.specs/features/invoices/design.md`
**Status**: Draft

---

## Execution Plan

```
Phase 1: Shared (Sequential — foundation)
  T1 → T2

Phase 2: Backend Core (Sequential — entities → service → controller → module)
  T3 → T4 → T5 → T6

Phase 3: Backend PDF + Migrations (Sequential, after Phase 2)
  T7 → T8

Phase 4: Backend Client Protection (after Phase 2)
  T9

Phase 5: Frontend Feature (Mixed)
  T10 → T11, T12, T13 [P]
  T11, T12, T13 → T14 → T15
  T15 → T16, T17 [P]

Phase 6: Integration (Sequential, after all phases)
  T18 → T19

Phase 7: Tests (Parallel, after integration)
  T20, T21 [P]
```

```
T1 ──→ T2 ──→ T3 ──→ T4 ──→ T5 ──→ T6 ──→ T7 ──→ T8
                                       │
                                       ├──→ T9
                                       │
T10 ──→ T11 ─┐                        │
       T12  ─┤ [P]                     │
       T13  ─┘                         │
              │                        │
              ▼                        │
             T14 ──→ T15 ──→ T16 ─┐   │
                            T17 ─┘   │
                              │      │
                              ▼      ▼
                             T18 ──→ T19
                                      │
                               T20, T21 [P]
```

---

## Task Breakdown

### Phase 1: Shared (Foundation)

### T1: Create Zod schemas for invoices

**What**: Zod schemas + enums for invoice/line item/extra validation (shared between frontend and backend)
**Where**: `packages/shared/src/schemas/invoices.ts`
**Depends on**: None
**Reuses**: Pattern from `packages/shared/src/schemas/clients.ts`, `CURRENCIES` from clients schema
**Requirement**: INV-01, INV-02, INV-05, INV-06

**Done when**:
- [ ] `INVOICE_STATUSES` const array exported (`draft`, `sent`, `paid`, `cancelled`)
- [ ] `invoiceStatusSchema` Zod enum exported
- [ ] `invoiceLineItemSchema` validates description (min 1, max 500), quantity (positive number), unitPrice (non-negative number), sortOrder (int)
- [ ] `invoiceExtraSchema` validates description (min 1, max 500), amount (positive number), sortOrder (int)
- [ ] `invoiceObjectSchema` (base, for frontend form) validates: clientId (UUID), issueDate, dueDate, currency, description (min 1), notes?, paymentInstructions?, lineItems (min 1, max 50), extras (max 20, optional array)
- [ ] `createInvoiceSchema` refines invoiceObjectSchema: dueDate >= issueDate
- [ ] `updateInvoiceSchema` matches createInvoiceSchema
- [ ] `updateInvoiceStatusSchema` validates status enum
- [ ] `listInvoicesQuerySchema` validates search?, status?, clientId?, sort?, page, limit
- [ ] All input types exported via `z.infer`
- [ ] No TypeScript errors: `pnpm --filter shared build`

**Verify**: `cd packages/shared && pnpm build`

**Commit**: `feat(shared): add Zod schemas and types for invoices`

---

### T2: Create response types for invoices

**What**: TypeScript types for API responses (not derived from Zod)
**Where**: `packages/shared/src/types/invoices.ts` + update `packages/shared/src/index.ts`
**Depends on**: T1 (needs enum types)
**Reuses**: Pattern from `packages/shared/src/types/clients.ts`
**Requirement**: INV-01, INV-03, INV-04, INV-08

**Done when**:
- [ ] `InvoiceLineItemResponse` type defined (id, description, quantity, unitPrice, amount, sortOrder)
- [ ] `InvoiceExtraResponse` type defined (id, description, amount, sortOrder)
- [ ] `InvoiceSummary` type defined (id, invoiceNumber, status, issueDate, dueDate, currency, total, clientFantasyName, clientId, createdAt)
- [ ] `InvoiceDetail` type defined (full invoice + embedded client summary + lineItems + extraItems + sentAt + paidAt)
- [ ] `InvoiceClientSummary` type defined (id, invoiceNumber, status, issueDate, total, currency) — for client detail page
- [ ] All types + schemas re-exported from `packages/shared/src/index.ts`
- [ ] No TypeScript errors: `pnpm --filter shared build`

**Verify**: `cd packages/shared && pnpm build`

**Commit**: `feat(shared): add invoice response types`

---

### Phase 2: Backend Core

### T3: Create Invoice, InvoiceLineItem, and InvoiceExtra entities

**What**: TypeORM entities for invoices, line items, and extras tables
**Where**: `packages/api/src/invoices/entities/invoice.entity.ts`, `invoice-line-item.entity.ts`, `invoice-extra.entity.ts`
**Depends on**: T1 (enum values must match)
**Reuses**: Pattern from `packages/api/src/clients/entities/client.entity.ts`
**Requirement**: INV-01, INV-05

**Done when**:
- [ ] Invoice entity with all columns from design, including comments on every @Column (except id)
- [ ] Invoice entity has UNIQUE constraint on (userId, invoiceNumber)
- [ ] Invoice.client relation with `onDelete: 'RESTRICT'`
- [ ] Invoice.user relation with `onDelete: 'CASCADE'`
- [ ] InvoiceLineItem entity with all columns, including `get amount()` getter (no DB column)
- [ ] InvoiceExtra entity with all columns
- [ ] Relations: Invoice OneToMany LineItem (cascade: true), Invoice OneToMany Extra (cascade: true)
- [ ] Decimal columns use `precision: 12, scale: 2` (or `precision: 10, scale: 2` for quantity)
- [ ] Enum values match Zod enums from T1
- [ ] No TypeScript errors: `pnpm --filter api build`

**Verify**: `cd packages/api && pnpm build`

**Commit**: `feat(api): add Invoice, InvoiceLineItem, and InvoiceExtra entities`

---

### T4: Create InvoicesService

**What**: Business logic service for CRUD, numbering, totals calculation, state machine
**Where**: `packages/api/src/invoices/invoices.service.ts`
**Depends on**: T3, CompanyService (existing)
**Reuses**: Pattern from `packages/api/src/clients/clients.service.ts` (Injectable, InjectRepository, transactions)
**Requirement**: INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-08, INV-09

**Done when**:
- [ ] `create(userId, dto)` — creates invoice + line items + extras in transaction, generates sequential number from Company.invoicePrefix, calculates and persists subtotal/extrasTotal/total
- [ ] `findAll(userId, query)` — paginated list with ILIKE search (invoiceNumber OR client.fantasyName), status filter, clientId filter, sort param, returns PaginatedResponse<InvoiceSummary>
- [ ] `findOne(userId, invoiceId)` — returns invoice with line items + extras + embedded client summary, throws NotFoundException if not found or wrong user
- [ ] `update(userId, invoiceId, dto)` — updates invoice + delete-all/re-insert line items + extras in transaction, recalculates totals, only draft status allowed (ConflictException otherwise)
- [ ] `updateStatus(userId, invoiceId, dto)` — state machine validation, sets sentAt/paidAt timestamps, ConflictException for invalid transitions
- [ ] `duplicate(userId, invoiceId)` — creates new draft with same data, new number, today's dates (P2)
- [ ] `findByClient(userId, clientId)` — returns InvoiceClientSummary[] sorted by issueDate DESC
- [ ] `countByClient(userId, clientId)` — returns count for delete protection
- [ ] All methods filter by userId (isolation), 404 for wrong user
- [ ] Invoice number generation: query MAX sequence + increment, UNIQUE constraint as safety net
- [ ] Totals: `subtotal = sum(li.quantity * li.unitPrice)`, `extrasTotal = sum(extras.amount)`, `total = subtotal + extrasTotal`
- [ ] No TypeScript errors: `pnpm --filter api build`

**Verify**: `cd packages/api && pnpm build`

**Commit**: `feat(api): add InvoicesService with CRUD, numbering, and state machine`

---

### T5: Create InvoicesController

**What**: REST endpoints wiring controller to service with validation
**Where**: `packages/api/src/invoices/invoices.controller.ts`
**Depends on**: T4, T1 (schemas for validation)
**Reuses**: Pattern from `packages/api/src/clients/clients.controller.ts`
**Requirement**: INV-01, INV-02, INV-03, INV-04, INV-05, INV-07, INV-09, INV-10

**Done when**:
- [ ] `POST /invoices` — creates invoice, uses ZodValidationPipe(createInvoiceSchema), returns 201
- [ ] `GET /invoices` — lists invoices with query params, uses ZodValidationPipe(listInvoicesQuerySchema) on @Query
- [ ] `GET /invoices/:id` — returns invoice detail with line items + extras + client
- [ ] `PUT /invoices/:id` — updates invoice (draft only), uses ZodValidationPipe(updateInvoiceSchema)
- [ ] `PATCH /invoices/:id/status` — changes status, uses ZodValidationPipe(updateInvoiceStatusSchema)
- [ ] `GET /invoices/:id/pdf` — streams PDF (delegates to PdfService), sets Content-Type and Content-Disposition headers
- [ ] `POST /invoices/:id/duplicate` — duplicates invoice (P2), returns 201
- [ ] `GET /invoices/by-client/:clientId` — returns invoices for a client (for client detail page)
- [ ] All endpoints use @CurrentUser() for userId injection
- [ ] All :id params use ParseUUIDPipe
- [ ] No TypeScript errors: `pnpm --filter api build`

**Verify**: `cd packages/api && pnpm build`

**Commit**: `feat(api): add InvoicesController with CRUD, PDF, and status endpoints`

---

### T6: Create InvoicesModule and register in AppModule

**What**: NestJS module wiring + registration
**Where**: `packages/api/src/invoices/invoices.module.ts`, `packages/api/src/app.module.ts` (modify)
**Depends on**: T5
**Reuses**: Pattern from `packages/api/src/clients/clients.module.ts`
**Requirement**: INV-01 through INV-10

**Done when**:
- [ ] InvoicesModule imports TypeOrmModule.forFeature([Invoice, InvoiceLineItem, InvoiceExtra])
- [ ] InvoicesModule imports CompanyModule (for CompanyService)
- [ ] InvoicesModule declares InvoicesController, InvoicesService, PdfService
- [ ] InvoicesModule exports InvoicesService (for ClientsModule to use countByClient)
- [ ] AppModule imports InvoicesModule
- [ ] App builds: `pnpm --filter api build`
- [ ] App starts without errors (entities auto-synced to DB)

**Verify**: `cd packages/api && pnpm build`

**Commit**: `feat(api): register InvoicesModule in AppModule`

---

### Phase 3: Backend PDF + Company Migration

### T7: Install PDFKit and create PdfService

**What**: Install pdfkit dependency and implement PDF generation service
**Where**: `packages/api/`, `packages/api/src/invoices/pdf.service.ts`
**Depends on**: T6 (entities must exist for types)
**Reuses**: None (new pattern)
**Requirement**: INV-07

**Done when**:
- [ ] `pdfkit` and `@types/pdfkit` installed in api package
- [ ] PdfService injectable with `generate(invoice, company, client): Promise<Buffer>`
- [ ] PDF layout: A4 page, Helvetica font, sections for From/To/Services table/Extras/Totals/Payment instructions
- [ ] Line items rendered as table with columns: Description, Qty, Rate, Amount
- [ ] Extras rendered as table with columns: Description, Amount (omitted if empty)
- [ ] Totals section: Subtotal, Extras, Total
- [ ] Payment instructions section (omitted if empty)
- [ ] Bank info section from Company data (omitted if incomplete)
- [ ] Currency formatting with `Intl.NumberFormat`
- [ ] Returns Buffer via PassThrough stream
- [ ] No TypeScript errors: `pnpm --filter api build`

**Verify**: `cd packages/api && pnpm build`

**Commit**: `feat(api): add PdfService for invoice PDF generation with PDFKit`

---

### T8: Add invoicePrefix to Company entity and schemas

**What**: Add invoicePrefix field to Company entity, schemas, and response type
**Where**: `packages/api/src/company/company.entity.ts` (modify), `packages/shared/src/schemas/company.ts` (modify), `packages/shared/src/types/company.ts` (modify)
**Depends on**: T6 (InvoicesService needs the field)
**Reuses**: Existing Company patterns
**Requirement**: INV-01

**Done when**:
- [ ] Company entity has `invoicePrefix` column (varchar(10), default 'INV', with comment)
- [ ] `createCompanySchema` includes `invoicePrefix` (string, min 1, max 10, default 'INV', uppercase transform)
- [ ] `updateCompanySchema` includes `invoicePrefix`
- [ ] `CompanyResponse` includes `invoicePrefix: string`
- [ ] CompanyService.toResponse includes invoicePrefix
- [ ] Company form on frontend shows invoicePrefix field (modify existing CompanyPage)
- [ ] No TypeScript errors: `pnpm --filter shared build && pnpm --filter api build`

**Verify**: `pnpm --filter shared build && pnpm --filter api build`

**Commit**: `feat: add invoicePrefix field to Company entity and schemas`

---

### Phase 4: Backend Client Protection

### T9: Protect client delete when invoices exist

**What**: Modify ClientsService.remove() to check for existing invoices before deleting
**Where**: `packages/api/src/clients/clients.service.ts` (modify), `packages/api/src/clients/clients.module.ts` (modify)
**Depends on**: T6 (InvoicesModule must export InvoicesService)
**Reuses**: Existing ClientsService
**Requirement**: INV-09

**Done when**:
- [ ] ClientsService injects InvoicesService (via forwardRef if needed for circular dep)
- [ ] `remove()` calls `invoicesService.countByClient()` before deleting
- [ ] If count > 0, throws ConflictException with message "Cannot delete client with existing invoices. Change status to inactive instead."
- [ ] ClientsModule imports InvoicesModule (or uses forwardRef)
- [ ] Existing client delete tests still pass
- [ ] No TypeScript errors: `pnpm --filter api build`

**Verify**: `cd packages/api && pnpm build`

**Commit**: `feat(api): block client deletion when invoices exist`

---

### Phase 5: Frontend Feature

### T10: Create invoices API service

**What**: HTTP service layer for invoice CRUD operations
**Where**: `packages/web/src/features/invoices/api/invoices.api.ts`
**Depends on**: T2 (response types)
**Reuses**: Pattern from `packages/web/src/features/clients/api/clients.api.ts`
**Requirement**: INV-01 through INV-10

**Done when**:
- [ ] `invoicesApi.create(data)` — POST /invoices
- [ ] `invoicesApi.list(params)` — GET /invoices with query params
- [ ] `invoicesApi.get(id)` — GET /invoices/:id
- [ ] `invoicesApi.update(id, data)` — PUT /invoices/:id
- [ ] `invoicesApi.updateStatus(id, status)` — PATCH /invoices/:id/status
- [ ] `invoicesApi.downloadPdf(id)` — GET /invoices/:id/pdf (responseType: blob)
- [ ] `invoicesApi.duplicate(id)` — POST /invoices/:id/duplicate
- [ ] `invoicesApi.listByClient(clientId)` — GET /invoices/by-client/:clientId
- [ ] All methods properly typed with shared types
- [ ] No TypeScript errors

**Verify**: `cd packages/web && pnpm build`

**Commit**: `feat(web): add invoices API service layer`

---

### T11: Create InvoiceStatusBadge and StatusChangeDialog components [P]

**What**: Reusable UI components for invoice status display and status change confirmation
**Where**: `packages/web/src/features/invoices/components/InvoiceStatusBadge.tsx`, `StatusChangeDialog.tsx`
**Depends on**: T10
**Reuses**: Pattern from ClientStatusBadge, DeleteClientDialog
**Requirement**: INV-03, INV-04, INV-06

**Done when**:
- [ ] InvoiceStatusBadge renders colored badge per status (draft=gray, sent=blue, paid=green, cancelled=red)
- [ ] StatusChangeDialog shows alert-dialog with action description (Send/Pay/Cancel), confirm/cancel buttons
- [ ] StatusChangeDialog calls onConfirm callback
- [ ] No TypeScript errors

**Verify**: `cd packages/web && pnpm build`

**Commit**: `feat(web): add InvoiceStatusBadge and StatusChangeDialog components`

---

### T12: Create LineItemsFieldArray and ExtrasFieldArray components [P]

**What**: Dynamic form arrays for managing line items and extras within invoice form
**Where**: `packages/web/src/features/invoices/components/LineItemsFieldArray.tsx`, `ExtrasFieldArray.tsx`
**Depends on**: T10
**Reuses**: Pattern from ContactsFieldArray
**Requirement**: INV-01, INV-05

**Done when**:
- [ ] LineItemsFieldArray renders rows: description, quantity, unitPrice, computed amount (qty * rate)
- [ ] "Add line item" button adds new row. Remove button (X) removes row (disabled if only 1)
- [ ] Shows subtotal footer (sum of amounts)
- [ ] At least 1 line item always present, max 50
- [ ] ExtrasFieldArray renders rows: description, amount
- [ ] "Add extra" button adds new row. Remove button (X) removes row
- [ ] Shows extras total footer. Can be empty (0 rows)
- [ ] Max 20 extras
- [ ] No TypeScript errors

**Verify**: `cd packages/web && pnpm build`

**Commit**: `feat(web): add LineItemsFieldArray and ExtrasFieldArray form components`

---

### T13: Create InvoicePreview component [P]

**What**: Client-side preview of invoice layout, reusable in form (live) and detail (read-only)
**Where**: `packages/web/src/features/invoices/components/InvoicePreview.tsx`
**Depends on**: T10
**Reuses**: None (new component, but uses shadcn Card/Separator)
**Requirement**: INV-02

**Done when**:
- [ ] Renders invoice layout: From (company), To (client), Services table, Extras table, Totals, Payment instructions
- [ ] Props accept company data, client data, line items, extras, dates, currency, description, paymentInstructions
- [ ] Auto-calculates amounts (qty * rate) and totals from props
- [ ] Currency formatting via `Intl.NumberFormat`
- [ ] Omits bank section if company data incomplete
- [ ] Omits extras section if no extras
- [ ] No `dangerouslySetInnerHTML` — pure React rendering
- [ ] No TypeScript errors

**Verify**: `cd packages/web && pnpm build`

**Commit**: `feat(web): add InvoicePreview client-side component`

---

### T14: Create InvoiceForm component

**What**: Shared form for create and edit invoice, with line items + extras sub-forms
**Where**: `packages/web/src/features/invoices/components/InvoiceForm.tsx`
**Depends on**: T12, T13, T1 (Zod schemas)
**Reuses**: TanStack Form + Zod, pattern from ClientForm
**Requirement**: INV-01, INV-02, INV-05

**Done when**:
- [ ] Form sections: Client selector, Issue/Due dates, Currency (pre-filled from client), Description, Line Items (via LineItemsFieldArray), Extras (via ExtrasFieldArray), Payment Instructions, Notes
- [ ] Selecting client pre-fills currency
- [ ] Validates against invoiceObjectSchema (Zod)
- [ ] Props: `defaultValues?`, `onSubmit`, `isSubmitting`, `clients: ClientSummary[]`
- [ ] Field-level error display
- [ ] Submit button with loading state
- [ ] No TypeScript errors

**Verify**: `cd packages/web && pnpm build`

**Commit**: `feat(web): add InvoiceForm component with validation`

---

### T15: Create InvoicesListPage

**What**: Main invoices page with DataTable, search, filters, and pagination
**Where**: `packages/web/src/features/invoices/pages/InvoicesListPage.tsx`
**Depends on**: T10, T11
**Reuses**: DataTable, DataTableColumnHeader, InvoiceStatusBadge, pattern from ClientsListPage
**Requirement**: INV-03

**Done when**:
- [ ] Column definitions: invoiceNumber, client (fantasyName), issueDate, dueDate, status (badge), total (formatted with currency), actions (dropdown: view, edit [if draft], duplicate [P2])
- [ ] Toolbar: search input (debounced 300ms), status filter select, client filter select, "New invoice" button
- [ ] Server-side pagination (10/page) via URL search params
- [ ] Server-side sorting via URL search params (default: issueDate:desc)
- [ ] Empty state with CTA "Create your first invoice"
- [ ] Row click navigates to detail page
- [ ] No TypeScript errors

**Verify**: `cd packages/web && pnpm build`

**Commit**: `feat(web): add InvoicesListPage with DataTable`

---

### T16: Create InvoiceDetailPage [P]

**What**: Invoice detail page with full data display and status-dependent actions
**Where**: `packages/web/src/features/invoices/pages/InvoiceDetailPage.tsx`
**Depends on**: T13 (InvoicePreview), T11 (StatusChangeDialog, InvoiceStatusBadge), T10
**Reuses**: InvoicePreview (read-only mode), pattern from ClientDetailPage
**Requirement**: INV-04, INV-06, INV-07

**Done when**:
- [ ] Header: invoice number, status badge, action buttons (conditional per status)
- [ ] Body: InvoicePreview with real invoice data (company from API, client embedded in invoice)
- [ ] Actions per status: draft (Edit, Mark as Sent, Cancel, Download PDF), sent (Mark as Paid, Cancel, Download PDF), paid/cancelled (Download PDF only)
- [ ] Duplicate button (P2) available in all statuses
- [ ] PDF download triggers blob download
- [ ] Status change shows confirmation dialog + mutation
- [ ] Handles loading and error states
- [ ] No TypeScript errors

**Verify**: `cd packages/web && pnpm build`

**Commit**: `feat(web): add InvoiceDetailPage with status actions and PDF download`

---

### T17: Create CreateInvoicePage and EditInvoicePage [P]

**What**: Invoice create and edit pages with form + preview side-by-side
**Where**: `packages/web/src/features/invoices/pages/CreateInvoicePage.tsx`, `EditInvoicePage.tsx`
**Depends on**: T14 (InvoiceForm), T13 (InvoicePreview), T10
**Reuses**: InvoiceForm, InvoicePreview, pattern from CreateClientPage/EditClientPage
**Requirement**: INV-01, INV-02, INV-05

**Done when**:
- [ ] **CreateInvoicePage**: Fetches company data + clients list. Side-by-side: InvoiceForm left, InvoicePreview right (responsive: stacked on mobile). If no company → blocks with "Set up your company info first". Supports `?clientId=X` query param to pre-select client. Create mutation redirects to detail on success.
- [ ] **EditInvoicePage**: Fetches invoice + company data. If invoice not draft → redirect to detail with message. Pre-fills form. Update mutation redirects to detail on success.
- [ ] Live preview updates as form data changes
- [ ] No TypeScript errors

**Verify**: `cd packages/web && pnpm build`

**Commit**: `feat(web): add invoice create and edit pages with live preview`

---

### Phase 6: Integration

### T18: Wire routes, navigation, and client detail invoices section

**What**: Add invoice routes, navigation links, and update client detail page
**Where**: `packages/web/src/app/router.tsx` (modify), `packages/web/src/features/clients/pages/ClientDetailPage.tsx` (modify)
**Depends on**: T15, T16, T17
**Requirement**: INV-01 through INV-09

**Done when**:
- [ ] Routes added inside ProtectedRoute: /invoices, /invoices/new, /invoices/:id, /invoices/:id/edit
- [ ] All pages lazy loaded
- [ ] Navigation from dashboard to invoices exists
- [ ] ClientDetailPage: "Invoices" section replaced with real data from `invoicesApi.listByClient(clientId)`
- [ ] Client invoices: mini-table (invoiceNumber, issueDate, status badge, total), rows clickable → /invoices/:id
- [ ] Client invoices empty state: "No invoices yet" + CTA "Create invoice" (links to /invoices/new?clientId=X)
- [ ] Client delete error 409 handled: shows toast/message "Cannot delete client with invoices" + offers to inactivate
- [ ] No TypeScript errors
- [ ] App builds: `pnpm --filter web build`

**Verify**: `cd packages/web && pnpm build`

**Commit**: `feat(web): add invoice routes, navigation, and client detail invoices section`

---

### T19: End-to-end smoke test (manual)

**What**: Verify full flow: create invoice → list → detail → edit → status transitions → PDF → duplicate
**Where**: Running app (docker-compose up + pnpm dev)
**Depends on**: T8, T9, T18

**Done when**:
- [ ] Can create invoice with line items + extras via form
- [ ] Invoice number auto-generated with company prefix
- [ ] Preview updates live as form changes
- [ ] Invoice appears in list with correct data
- [ ] Search, filters, sorting, pagination work
- [ ] Detail page shows all data via InvoicePreview + correct action buttons
- [ ] Edit updates invoice (draft only)
- [ ] Status transitions: draft → sent → paid work with timestamps
- [ ] Cancel works from draft and sent
- [ ] PDF downloads with correct layout and data
- [ ] Duplicate creates new draft with same data (P2)
- [ ] Client detail page shows invoice history
- [ ] Client with invoices cannot be deleted (409 handled)
- [ ] Client without invoices can be deleted
- [ ] Another user cannot see/edit/delete the invoice (404)
- [ ] Invoice creation blocked without company data

**Verify**: Manual test in browser

**Commit**: No commit (verification only)

---

### Phase 7: Tests

### T20: Backend unit tests (InvoicesService) [P]

**What**: Unit tests for InvoicesService with mocked repositories
**Where**: `packages/api/src/invoices/invoices.service.spec.ts`
**Depends on**: T4
**Reuses**: Pattern from `packages/api/src/clients/clients.service.spec.ts`
**Requirement**: INV-01 through INV-10

**Done when**:
- [ ] Tests for create: success with auto-number and computed totals, validation (dueDate < issueDate), no company → error
- [ ] Tests for findAll: paginated data, filters (search/status/clientId), sorting, user isolation
- [ ] Tests for findOne: success, not found, wrong user returns 404
- [ ] Tests for update: success, draft-only enforcement, totals recalculated, ownership check
- [ ] Tests for updateStatus: valid transitions (draft→sent, sent→paid, draft→cancelled, sent→cancelled), invalid transitions rejected, timestamps set
- [ ] Tests for duplicate: creates new draft with new number and today's dates
- [ ] Tests for findByClient: returns invoices sorted by issueDate DESC
- [ ] Tests for countByClient: returns correct count
- [ ] All tests pass: `pnpm --filter api test:unit`

**Verify**: `cd packages/api && pnpm test:unit`

**Commit**: `test(api): add InvoicesService unit tests`

---

### T21: Backend integration tests [P]

**What**: Integration tests for invoice API endpoints with real DB
**Where**: `packages/api/test/invoices/*.integration.ts`
**Depends on**: T6
**Reuses**: Pattern from `packages/api/test/clients/clients.integration.ts`, test helpers
**Requirement**: INV-01 through INV-10

**Done when**:
- [ ] POST /invoices: success (201) with auto-number, validation errors (400), computed totals correct
- [ ] GET /invoices: paginated list, search works, filters work, sorting works, user isolation
- [ ] GET /invoices/:id: success, 404 for non-existent, 404 for other user's invoice
- [ ] PUT /invoices/:id: success (draft), 409 for non-draft, ownership check, totals recalculated
- [ ] PATCH /invoices/:id/status: valid transitions work, invalid rejected (409), timestamps set
- [ ] GET /invoices/:id/pdf: returns PDF (content-type check), 404 for other user
- [ ] POST /invoices/:id/duplicate: creates new draft (201), correct data
- [ ] GET /invoices/by-client/:clientId: returns invoices, user isolation
- [ ] DELETE /clients/:id: blocked (409) when client has invoices, success when no invoices
- [ ] All tests pass: `pnpm --filter api test:integration`

**Verify**: `cd packages/api && pnpm test:integration`

**Commit**: `test(api): add invoice integration tests`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1 ──→ T2

Phase 2 (Sequential, after T1):
  T3 ──→ T4 ──→ T5 ──→ T6

Phase 3 (Sequential, after T6):
  T7 ──→ T8

Phase 4 (After T6):
  T9

Phase 5 (Mixed, after T2):
  T10 ──→ T11 [P]
     ├──→ T12 [P]
     └──→ T13 [P]
             ├──→ T14 ──→ T15 ──→ T16 [P]
             │                   └──→ T17 [P]

Phase 6 (Sequential, after Phase 3 + 4 + 5):
  T18 ──→ T19

Phase 7 (Parallel, after Phase 2):
  T20 [P]
  T21 [P]
```

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: Zod schemas | 1 file + enums | OK |
| T2: Response types | 1 file + exports | OK |
| T3: Entities | 3 files (cohesive — same domain) | OK |
| T4: Service | 1 file (large but single concern) | OK |
| T5: Controller | 1 file | OK |
| T6: Module + register | 2 files (minimal) | OK |
| T7: PdfService + install | 1 file + deps | OK |
| T8: Company migration | 3 files (entity + schema + type, minimal change) | OK |
| T9: Client delete protection | 2 files (service + module, minimal change) | OK |
| T10: API service | 1 file | OK |
| T11: Badge + Dialog | 2 small components (cohesive) | OK |
| T12: FieldArrays | 2 components (cohesive, same pattern) | OK |
| T13: InvoicePreview | 1 component | OK |
| T14: InvoiceForm | 1 component | OK |
| T15: InvoicesListPage | 1 page | OK |
| T16: InvoiceDetailPage | 1 page | OK |
| T17: Create + Edit pages | 2 pages (thin wrappers, cohesive) | OK |
| T18: Routes + client integration | 2 files (router + client detail page) | OK |
| T19: Smoke test | Manual | OK |
| T20: Unit tests | 1 test file | OK |
| T21: Integration tests | 1 test dir | OK |
