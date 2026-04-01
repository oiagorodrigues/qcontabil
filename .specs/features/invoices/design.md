# Invoice Generation Design

**Spec**: `.specs/features/invoices/spec.md`
**Context**: `.specs/features/invoices/context.md`
**Status**: Draft

---

## Architecture Overview

Segue o mesmo padrao modular do CRM clients: NestJS module no backend, feature folder no frontend, schemas compartilhados. Adiciona um PDF service isolado no backend e um componente InvoicePreview reutilizavel no frontend.

```
                    ┌─────────────┐
                    │   Browser   │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │    React SPA (Vite)     │
              │  features/invoices/     │
              │  ├── pages/             │
              │  ├── components/        │
              │  │   └── InvoicePreview │ ← reutilizado no form (live) e no detail
              │  └── api/               │
              └────────────┬────────────┘
                           │ HTTP (Vite proxy)
              ┌────────────┴────────────┐
              │   NestJS API            │
              │   invoices/             │
              │   ├── controller        │
              │   ├── service           │
              │   ├── pdf.service       │ ← PDFKit, gera PDF em stream
              │   └── entities          │
              └────────────┬────────────┘
                           │ TypeORM
              ┌────────────┴────────────┐
              │      PostgreSQL         │
              │  invoices + line_items  │
              │  + invoice_extras       │
              └─────────────────────────┘
```

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --- | --- | --- |
| JwtAuthGuard (global) | `api/src/auth/guards/` | Todas as rotas ja protegidas |
| @CurrentUser() | `api/src/auth/decorators/` | Extrair userId do JWT no controller |
| ZodValidationPipe | `api/src/common/pipes/` | Validar request body nos endpoints |
| ParseUUIDPipe | `@nestjs/common` | Validar :id params |
| httpClient | `web/src/lib/http-client.ts` | Chamadas API com refresh automatico |
| DataTable + components | `web/src/components/data-table/` | Listagem de invoices reutiliza DataTable generico |
| ClientStatusBadge pattern | `web/src/features/clients/components/` | Mesmo padrao pra InvoiceStatusBadge |
| DeleteClientDialog pattern | `web/src/features/clients/components/` | Padrao pra ConfirmDialog (status change, cancel) |
| ClientForm pattern | `web/src/features/clients/components/` | Padrao TanStack Form + Zod pra InvoiceForm |
| ClientsListPage pattern | `web/src/features/clients/pages/` | Mesmo padrao DataTable + URL search params |
| ClientDetailPage | `web/src/features/clients/pages/` | Modificar secao Invoices vazia → lista real |
| CompanyService.findByUser | `api/src/company/company.service.ts` | Buscar dados do emissor pra PDF |
| ClientsService | `api/src/clients/clients.service.ts` | Buscar dados do client pra PDF. Modificar remove() pra check invoices |
| PaginatedResponse\<T\> | `shared/src/index.ts` | Tipo de resposta paginada |
| CURRENCIES, CLIENT_STATUSES | `shared/src/schemas/clients.ts` | Reutilizar enum de currencies |

### Integration Points

| System | Integration Method |
| --- | --- |
| Auth (User entity) | Invoice.userId FK → User.id, injetado via @CurrentUser() |
| Company module | InvoicesService injeta CompanyService pra buscar dados do emissor no PDF e validar existencia |
| Clients module | Invoice.clientId FK → Client.id. ClientsService.remove() verifica invoices antes de deletar |
| TypeORM | autoLoadEntities — registrar entities no module |
| Router | Adicionar rotas dentro do ProtectedRoute existente |

### New Dependencies

| Package | Where | Purpose |
| --- | --- | --- |
| `pdfkit` | api | PDF generation server-side |
| `@types/pdfkit` | api (dev) | TypeScript types |

---

## Components

### Backend

#### InvoicesModule

- **Purpose**: NestJS module que encapsula CRUD de invoices + geracao de PDF
- **Location**: `packages/api/src/invoices/`
- **Structure**:
  ```
  invoices/
  ├── invoices.module.ts
  ├── invoices.controller.ts
  ├── invoices.service.ts
  ├── pdf.service.ts
  └── entities/
      ├── invoice.entity.ts
      ├── invoice-line-item.entity.ts
      └── invoice-extra.entity.ts
  ```
- **Dependencies**: TypeOrmModule, CompanyModule (pra CompanyService), ClientsModule (pra check no delete)
- **Registration**: Importar no AppModule

#### InvoicesController

- **Purpose**: Endpoints REST para CRUD de invoices + PDF download + status transitions
- **Location**: `packages/api/src/invoices/invoices.controller.ts`
- **Endpoints**:
  - `POST /api/invoices` — criar invoice (draft) com line items + extras
  - `GET /api/invoices` — listar com paginacao/busca/filtro
  - `GET /api/invoices/:id` — detalhe com line items + extras
  - `PUT /api/invoices/:id` — atualizar invoice (so draft)
  - `PATCH /api/invoices/:id/status` — mudar status (state machine)
  - `GET /api/invoices/:id/pdf` — download PDF
  - `POST /api/invoices/:id/duplicate` — duplicar invoice (P2)
- **Reuses**: @CurrentUser(), ZodValidationPipe, ParseUUIDPipe

#### InvoicesService

- **Purpose**: Business logic de invoices — CRUD, numeracao, totais, state machine, duplicacao
- **Location**: `packages/api/src/invoices/invoices.service.ts`
- **Interfaces**:
  - `create(userId: string, dto: CreateInvoiceInput): Promise<InvoiceDetail>` — cria invoice + line items + extras em transacao, gera numero, calcula totais
  - `findAll(userId: string, query: ListInvoicesQuery): Promise<PaginatedResponse<InvoiceSummary>>` — lista paginada com filtros
  - `findOne(userId: string, invoiceId: string): Promise<InvoiceDetail>` — detalhe com line items + extras
  - `update(userId: string, invoiceId: string, dto: UpdateInvoiceInput): Promise<InvoiceDetail>` — atualiza (so draft)
  - `updateStatus(userId: string, invoiceId: string, dto: UpdateInvoiceStatusInput): Promise<InvoiceDetail>` — state machine
  - `duplicate(userId: string, invoiceId: string): Promise<InvoiceDetail>` — cria novo draft baseado em existente (P2)
  - `findByClient(userId: string, clientId: string): Promise<InvoiceClientSummary[]>` — invoices de um client (pra detalhe do client)
  - `countByClient(userId: string, clientId: string): Promise<number>` — count pra check de delete
- **Dependencies**: Repository\<Invoice\>, Repository\<InvoiceLineItem\>, Repository\<InvoiceExtra\>, DataSource, CompanyService
- **Invoice number generation**:
  ```
  1. Buscar Company.invoicePrefix do user (default "INV")
  2. SELECT MAX(CAST(SPLIT_PART(invoice_number, '-', 2) AS INT)) FROM invoices WHERE user_id = ?
  3. Se null → 1, senao → max + 1
  4. Format: {prefix}-{number.toString().padStart(4, '0')}
  5. DB UNIQUE(userId, invoiceNumber) como safety net
  ```
- **Totals calculation** (em create/update):
  ```
  subtotal = sum(lineItems.map(li => li.quantity * li.unitPrice))
  extras = sum(extraItems.map(e => e.amount))
  total = subtotal + extras
  ```

#### PdfService

- **Purpose**: Gera PDF do invoice usando PDFKit
- **Location**: `packages/api/src/invoices/pdf.service.ts`
- **Interfaces**:
  - `generate(invoice: Invoice, company: Company, client: Client): Promise<Buffer>` — gera PDF completo em buffer
- **Dependencies**: PDFKit (import pdfkit)
- **PDF Layout**:
  ```
  ┌─────────────────────────────────────────┐
  │ [Company Legal Name]          INVOICE   │
  │ [Company Address]        [Invoice #]    │
  │ [Company Email/Phone]    [Issue Date]   │
  │                          [Due Date]     │
  │                          [Status]       │
  ├─────────────────────────────────────────┤
  │ FROM:                    TO:            │
  │ [Company Name]           [Client Name]  │
  │ [Company Address]        [Client Addr]  │
  │ [Company CNPJ]           [Client Email] │
  ├─────────────────────────────────────────┤
  │ SERVICES                                │
  │ Description  │  Qty  │ Rate │  Amount   │
  │ ─────────────┼───────┼──────┼────────── │
  │ Dev work     │ 160h  │ $50  │ $8,000    │
  │ Consulting   │  10h  │ $80  │   $800    │
  │                         Subtotal: $8,800│
  ├─────────────────────────────────────────┤
  │ EXTRAS (if any)                         │
  │ Description              │  Amount      │
  │ ─────────────────────────┼───────────── │
  │ Performance bonus        │    $500      │
  │                     Extras: $500        │
  ├─────────────────────────────────────────┤
  │                  TOTAL: $9,300          │
  ├─────────────────────────────────────────┤
  │ PAYMENT INSTRUCTIONS (if any)           │
  │ [Bank: ...]                             │
  │ [IBAN: ...]                             │
  │ [SWIFT: ...]                            │
  │ [Custom instructions text]              │
  └─────────────────────────────────────────┘
  ```
- **Implementation notes**:
  - PDFKit nao tem table nativo robusto — usar `doc.text()` + `doc.moveTo().lineTo().stroke()` pra desenhar linhas e alinhar colunas
  - `doc.table()` existe na versão mais recente do PDFKit (confirmado via Context7) — avaliar se a API é suficiente para o layout, senão fallback para text + lines
  - Fontes: Helvetica (built-in) — sem custom fonts no v1
  - Page: A4
  - Retornar Buffer via `doc.pipe()` com PassThrough stream
  - Currency formatting: `Intl.NumberFormat` com currency code do invoice

#### Modificacoes em modulos existentes

**CompanyModule** — exportar CompanyService (se nao ja exporta):
- InvoicesModule precisa injetar CompanyService pra buscar dados do emissor

**CompanyEntity** — adicionar campo:
- `invoicePrefix: string` (length 10, default 'INV', comment)

**CompanyService** — sem mudancas de interface, so o campo novo no entity/schema

**Company schemas (shared)** — adicionar `invoicePrefix` no createCompanySchema e updateCompanySchema

**CompanyResponse (shared)** — adicionar `invoicePrefix: string`

**ClientsService.remove()** — modificar pra checar invoices antes de deletar:
```typescript
async remove(userId: string, clientId: string): Promise<void> {
  const client = await this.clientRepository.findOneBy({ id: clientId, userId })
  if (!client) throw new NotFoundException('Client not found')

  const invoiceCount = await this.invoicesService.countByClient(userId, clientId)
  if (invoiceCount > 0) {
    throw new ConflictException('Cannot delete client with existing invoices. Change status to inactive instead.')
  }

  await this.clientRepository.remove(client)
}
```

**ClientsModule** — importar InvoicesModule (ou usar circular dependency resolution via forwardRef se necessario)

### Shared

#### Schemas (`packages/shared/src/schemas/invoices.ts`)

- **Purpose**: Zod schemas para validacao client+server
- **Schemas**:
  - `invoiceStatusSchema` — z.enum(['draft', 'sent', 'paid', 'cancelled'])
  - `invoiceLineItemSchema` — description, quantity (positive number), unitPrice (non-negative number), sortOrder
  - `invoiceExtraSchema` — description, amount (positive number), sortOrder
  - `createInvoiceSchema` — clientId (UUID), issueDate, dueDate, currency, description, notes?, paymentInstructions?, lineItems (min 1), extras (optional array). Refine: dueDate >= issueDate
  - `updateInvoiceSchema` — mesmo que create
  - `updateInvoiceStatusSchema` — status (only valid transitions)
  - `listInvoicesQuerySchema` — search?, status?, clientId?, sort?, page, limit
- **Enums/Constants**: `INVOICE_STATUSES` array const

#### Types (`packages/shared/src/types/invoices.ts`)

- **Purpose**: Types manuais para responses
- **Types**:
  ```typescript
  interface InvoiceLineItemResponse {
    id: string
    description: string
    quantity: number
    unitPrice: number
    amount: number        // getter: quantity * unitPrice
    sortOrder: number
  }

  interface InvoiceExtraResponse {
    id: string
    description: string
    amount: number
    sortOrder: number
  }

  interface InvoiceSummary {
    id: string
    invoiceNumber: string
    status: InvoiceStatus
    issueDate: string      // ISO date string
    dueDate: string
    currency: Currency
    total: number
    clientFantasyName: string
    clientId: string
    createdAt: string
  }

  interface InvoiceDetail {
    id: string
    invoiceNumber: string
    status: InvoiceStatus
    issueDate: string
    dueDate: string
    sentAt: string | null
    paidAt: string | null
    currency: Currency
    description: string
    notes: string | null
    paymentInstructions: string | null
    subtotal: number
    extras: number
    total: number
    clientId: string
    client: {              // embedded client summary pra preview/detail
      fantasyName: string
      company: string
      email: string
      address: string | null
      country: string
      countryCode: string
    }
    lineItems: InvoiceLineItemResponse[]
    extraItems: InvoiceExtraResponse[]
    createdAt: string
    updatedAt: string
  }

  // Pra listagem de invoices no detalhe do cliente
  interface InvoiceClientSummary {
    id: string
    invoiceNumber: string
    status: InvoiceStatus
    issueDate: string
    total: number
    currency: Currency
  }
  ```

### Frontend

#### Feature Structure

```
packages/web/src/features/invoices/
├── api/
│   └── invoices.api.ts           # Service layer (httpClient calls)
├── components/
│   ├── InvoiceForm.tsx            # Form para create/edit (TanStack Form + Zod)
│   ├── LineItemsFieldArray.tsx    # Sub-form de line items (add/remove rows)
│   ├── ExtrasFieldArray.tsx       # Sub-form de extras (add/remove rows)
│   ├── InvoicePreview.tsx         # Preview client-side (layout do invoice)
│   ├── InvoiceStatusBadge.tsx     # Badge colorido por status
│   └── StatusChangeDialog.tsx     # Confirmacao de mudanca de status
└── pages/
    ├── InvoicesListPage.tsx       # Listagem paginada + busca + filtros
    ├── InvoiceDetailPage.tsx      # Detalhe completo + acoes por status
    ├── CreateInvoicePage.tsx      # Form + preview side-by-side
    └── EditInvoicePage.tsx        # Form + preview side-by-side (pre-filled, so draft)
```

#### InvoiceForm

- **Purpose**: Form compartilhado entre create e edit, com sub-forms de line items e extras
- **Library**: TanStack Form + Zod (mesmo padrao do ClientForm)
- **Props**: `defaultValues?`, `onSubmit`, `isSubmitting`, `clients: ClientSummary[]` (pra select)
- **Sections**: Client selector, Dates, Currency, Description, Line Items (via LineItemsFieldArray), Extras (via ExtrasFieldArray), Payment Instructions, Notes
- **Behavior**:
  - Selecionar client → pre-fill currency do client
  - Line items: auto-calculate amount (quantity * unitPrice) e subtotal
  - Extras: auto-calculate extras total
  - Grand total: subtotal + extras (atualizado live)
- **Validation**: `invoiceObjectSchema` (base, sem refine) pra TanStack Form
- **Reuses**: shadcn/ui (input, select, textarea, button, label, separator), padrao do ClientForm

#### LineItemsFieldArray

- **Purpose**: Gerenciar lista de line items (add/remove rows com description, qty, rate)
- **Padrao**: Mesmo do ContactsFieldArray
- **Constraints**: Min 1 line item
- **UX**: Cada row mostra amount computed (qty * rate). Subtotal no footer.

#### ExtrasFieldArray

- **Purpose**: Gerenciar lista de extras (add/remove rows com description, amount)
- **Padrao**: Mesmo do ContactsFieldArray
- **Constraints**: Pode ser vazio (extras sao opcionais)
- **UX**: Extras total no footer.

#### InvoicePreview

- **Purpose**: Preview client-side do layout do invoice, renderizado em React
- **Location**: `packages/web/src/features/invoices/components/InvoicePreview.tsx`
- **Props**:
  ```typescript
  interface InvoicePreviewProps {
    company: CompanyResponse | null    // dados do emissor
    client: ClientDetail | null        // dados do client selecionado
    invoiceNumber?: string             // auto-generated ou existente
    issueDate: string
    dueDate: string
    currency: string
    description: string
    lineItems: { description: string; quantity: number; unitPrice: number }[]
    extras: { description: string; amount: number }[]
    paymentInstructions?: string
  }
  ```
- **Layout**: Espelha o layout do PDF (From/To/Services table/Extras/Totals/Payment)
- **Styling**: Card com border, monospace pra numeros, grid layout
- **Reutilizacao**: Usado em CreateInvoicePage e EditInvoicePage (live preview), e tambem na InvoiceDetailPage (read-only com dados reais)
- **Currency formatting**: `Intl.NumberFormat` no client com currency code

#### InvoiceStatusBadge

- **Purpose**: Badge colorido por status do invoice
- **Padrao**: Mesmo do ClientStatusBadge
- **Colors**: draft=gray, sent=blue, paid=green, cancelled=red

#### StatusChangeDialog

- **Purpose**: Confirmacao antes de mudar status
- **Padrao**: Mesmo do DeleteClientDialog (alert-dialog)
- **Props**: `open`, `onOpenChange`, `action` (send/pay/cancel), `onConfirm`, `isPending`

#### InvoicesListPage

- **Purpose**: Listagem paginada de invoices com busca, filtros, DataTable
- **Padrao**: Identico ao ClientsListPage
- **Columns**: invoiceNumber, client (fantasyName), issueDate, dueDate, status (badge), total (formatted), actions (dropdown: view, edit [se draft], duplicate [P2])
- **Toolbar**: Search input (debounced 300ms), status filter select, client filter select, "New invoice" button
- **Sorting**: Server-side via URL search params (default: issueDate:desc)
- **Empty state**: CTA "Create your first invoice"

#### InvoiceDetailPage

- **Purpose**: Visualizar invoice completo + acoes por status
- **Sections**: Header (number, status badge, actions), InvoicePreview (read-only com dados reais)
- **Actions por status**:
  - draft: Edit, Mark as Sent, Cancel, Download PDF
  - sent: Mark as Paid, Cancel, Download PDF
  - paid/cancelled: Download PDF only
  - Duplicate (P2): disponivel em todos os status

#### CreateInvoicePage / EditInvoicePage

- **Purpose**: Form + preview side-by-side
- **Layout**: Grid 2 colunas — form na esquerda, InvoicePreview na direita (responsive: stacked em mobile)
- **CreateInvoicePage**:
  - Busca company data (pra preview) e lista de clients (pra select)
  - Se company nao existe → bloqueia com mensagem "Set up your company info first"
  - Invoice number mostrado como placeholder (proximo numero estimado, gerado no server no submit)
- **EditInvoicePage**:
  - Busca invoice existente + company data
  - Se invoice nao e draft → redirect pra detail com toast "Only draft invoices can be edited"

#### Modificacoes em paginas existentes

**ClientDetailPage** — substituir secao "Invoices" vazia:
- Buscar `invoicesApi.listByClient(clientId)` (novo endpoint ou param)
- Mostrar mini-tabela: invoiceNumber, issueDate, status (badge), total
- Cada row clicavel → navega pra `/invoices/:id`
- Empty: "No invoices yet" + CTA "Create invoice" (link pra `/invoices/new?clientId=X`)

**DeleteClientDialog / ClientDetailPage** — tratar erro 409 Conflict:
- Se delete retorna 409, mostrar toast/mensagem "Cannot delete client with invoices" + oferecer inativar

#### Routes

Adicionar dentro do `<Route element={<ProtectedRoute />}>`:

```tsx
<Route path="/invoices" element={<InvoicesListPage />} />
<Route path="/invoices/new" element={<CreateInvoicePage />} />
<Route path="/invoices/:id" element={<InvoiceDetailPage />} />
<Route path="/invoices/:id/edit" element={<EditInvoicePage />} />
```

---

## Data Models

### Invoice Entity

```typescript
@Entity('invoices')
@Unique(['userId', 'invoiceNumber'])
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ length: 20, comment: 'Sequential number: {PREFIX}-{0001}' })
  invoiceNumber!: string

  @Column({
    type: 'enum',
    enum: ['draft', 'sent', 'paid', 'cancelled'],
    default: 'draft',
    comment: 'Invoice lifecycle status',
  })
  status!: string

  @Column({ type: 'date', comment: 'Issue date' })
  issueDate!: string

  @Column({ type: 'date', comment: 'Due date (must be >= issueDate)' })
  dueDate!: string

  @Column({ type: 'timestamp', nullable: true, comment: 'When status changed to sent' })
  sentAt!: Date | null

  @Column({ type: 'timestamp', nullable: true, comment: 'When status changed to paid' })
  paidAt!: Date | null

  @Column({
    type: 'enum',
    enum: ['USD', 'EUR', 'GBP', 'BRL', 'CAD', 'AUD', 'JPY', 'CHF'],
    comment: 'Billing currency',
  })
  currency!: string

  @Column({ type: 'text', comment: 'General description of services rendered' })
  description!: string

  @Column({ type: 'text', nullable: true, comment: 'Internal notes (not shown on PDF)' })
  notes!: string | null

  @Column({ type: 'text', nullable: true, comment: 'Payment instructions (shown on PDF)' })
  paymentInstructions!: string | null

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: 'Sum of line item amounts' })
  subtotal!: number

  @Column({ name: 'extras_total', type: 'decimal', precision: 12, scale: 2, default: 0, comment: 'Sum of extra amounts' })
  extrasTotal!: number

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: 'subtotal + extrasTotal' })
  total!: number

  @Column({ comment: 'Client FK' })
  clientId!: string

  @ManyToOne('Client', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'clientId' })
  client!: Client

  @Column({ comment: 'Owner user ID' })
  userId!: string

  @ManyToOne('User', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User

  @OneToMany('InvoiceLineItem', 'invoice', { cascade: true })
  lineItems!: InvoiceLineItem[]

  @OneToMany('InvoiceExtra', 'invoice', { cascade: true })
  extraItems!: InvoiceExtra[]

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
```

### InvoiceLineItem Entity

```typescript
@Entity('invoice_line_items')
export class InvoiceLineItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ length: 500, comment: 'Service description' })
  description!: string

  @Column({ type: 'decimal', precision: 10, scale: 2, comment: 'Hours or units' })
  quantity!: number

  @Column({ type: 'decimal', precision: 12, scale: 2, comment: 'Rate per unit' })
  unitPrice!: number

  // Getter — no DB column
  get amount(): number {
    return Number(this.quantity) * Number(this.unitPrice)
  }

  @Column({ type: 'int', comment: 'Display order' })
  sortOrder!: number

  @Column({ comment: 'Parent invoice ID' })
  invoiceId!: string

  @ManyToOne('Invoice', 'lineItems', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoiceId' })
  invoice!: Invoice

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
```

### InvoiceExtra Entity

```typescript
@Entity('invoice_extras')
export class InvoiceExtra {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ length: 500, comment: 'Extra description (e.g. Bonus, Reimbursement)' })
  description!: string

  @Column({ type: 'decimal', precision: 12, scale: 2, comment: 'Extra amount (positive)' })
  amount!: number

  @Column({ type: 'int', comment: 'Display order' })
  sortOrder!: number

  @Column({ comment: 'Parent invoice ID' })
  invoiceId!: string

  @ManyToOne('Invoice', 'extraItems', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoiceId' })
  invoice!: Invoice

  @CreateDateColumn()
  createdAt!: Date

  @UpdateDateColumn()
  updatedAt!: Date
}
```

### Company Entity (modificacao)

```typescript
// Adicionar campo:
@Column({
  name: 'invoice_prefix',
  type: 'varchar',
  length: 10,
  default: 'INV',
  comment: 'Prefix for invoice numbers (e.g. INV, ACME)',
})
invoicePrefix!: string
```

**Relationships**:
- User 1→N Invoice (userId FK, CASCADE delete)
- Client 1→N Invoice (clientId FK, RESTRICT delete — block delete)
- Invoice 1→N InvoiceLineItem (invoiceId FK, CASCADE delete)
- Invoice 1→N InvoiceExtra (invoiceId FK, CASCADE delete)

---

## State Machine

```
        ┌──────────┐
        │  draft   │
        └────┬─────┘
             │
      ┌──────┴──────┐
      │             │
      ▼             ▼
 ┌────────┐   ┌───────────┐
 │  sent  │   │ cancelled │
 └────┬───┘   └───────────┘
      │             ▲
      ├─────────────┘
      │
      ▼
 ┌────────┐
 │  paid  │
 └────────┘
```

**Valid transitions**:
| From | To | Action |
| --- | --- | --- |
| draft | sent | Mark as Sent (sets sentAt) |
| draft | cancelled | Cancel |
| sent | paid | Mark as Paid (sets paidAt) |
| sent | cancelled | Cancel |

**Invalid**: paid → anything, cancelled → anything

---

## Error Handling Strategy

| Error Scenario | HTTP Status | User Impact |
| --- | --- | --- |
| Validation failed (missing/invalid fields) | 400 | Field-level errors no form |
| Invoice not found (or wrong user) | 404 | "Invoice not found" |
| Edit non-draft invoice | 409 | "Only draft invoices can be edited" |
| Invalid status transition | 409 | "Cannot change status from X to Y" |
| Delete client with invoices | 409 | "Cannot delete client with existing invoices" |
| Company not found (create invoice) | 400 | "Set up your company info before creating invoices" |
| Duplicate invoice number (race condition) | 409 | Retry with next number (handled in service) |
| dueDate < issueDate | 400 | "Due date must be on or after issue date" |
| Server error | 500 | Generic "Something went wrong" |

---

## Tech Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| PDF library | PDFKit | Leve, sem browser headless, chainable API, built-in fonts, table support |
| PDF endpoint | GET /invoices/:id/pdf | Streaming response, cacheable, simple |
| PDF response | `Content-Type: application/pdf`, `Content-Disposition: attachment` | Download direto no browser |
| Line items sync | Delete all + re-insert (same as contacts) | Simples, items sao poucos (<20), sem FKs externas |
| Invoice-Client FK | RESTRICT delete | Previne delete acidental. ConflictException no service |
| Status transitions | Service-level validation (state machine map) | Sem lib externa, transitions sao simples (4 transitions validas) |
| Currency formatting | `Intl.NumberFormat` client-side, `Intl.NumberFormat` no PDFKit server-side | Consistente, built-in, sem dependencia |
| Decimal handling | `decimal` no PostgreSQL, `number` no TypeScript | TypeORM retorna strings pra decimal — converter com `Number()` no toResponse |
| Circular dependency (Clients ↔ Invoices) | InvoicesModule exporta countByClient, ClientsModule usa forwardRef | Alternativa: mover check pra um shared service. forwardRef e mais simples pra 1 metodo |
| Preview | Client-side React component | Zero server cost, instant feedback, reutilizavel no detail |
| Form layout (create/edit) | Side-by-side: form left, preview right | UX padrao de invoice builders — ver resultado em tempo real |
