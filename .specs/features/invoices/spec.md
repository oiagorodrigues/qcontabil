# Invoice Generation Specification

## Problem Statement

O app gerencia clientes mas nao tem como gerar invoices — o core do produto. Freelancers BR que faturam empresas estrangeiras precisam emitir invoices profissionais com dados do servico, valores em moeda estrangeira, e gerar PDFs para envio. Sem isso, o app nao tem valor real alem de um CRM basico.

## Goals

- [ ] Criar invoices vinculados a clientes com dados de servico e valores
- [ ] Numeracao sequencial automatica por usuario com prefixo customizavel ({PREFIX}-0001)
- [ ] Gerar PDF profissional do invoice (dados do emissor + cliente + servicos)
- [ ] Gerenciar ciclo de vida do invoice (draft → sent → paid)
- [ ] Listar invoices com busca, filtros e paginacao
- [ ] Proteger dados com isolamento por usuario

## Out of Scope

| Feature | Reason |
| --- | --- |
| Envio automatico de invoice por email | M3 — Automacao de Envio |
| Integracao com provedor de pagamento | M3 — Automacao de Envio |
| Multi-moeda com conversao automatica | Future Considerations — complexidade desnecessaria no v1 |
| Invoices recorrentes (auto-gerar mensal) | M3 — sera template, nao duplicacao manual |
| Impostos / tax calculation | Fora do escopo MEI/EI — contractor emite invoice isento |
| Desconto / discount fields | Complexidade desnecessaria — pode ser ajustado no rate/total |
| Partial payments / payment tracking | M3 — status binario (paid/unpaid) e suficiente agora |
| Invoice templates customizaveis | M3 — Invoice Templates. v1 usa 1 template fixo |
| Assinatura digital / certificado | Compliance futuro |

---

## Data Model

### Invoice

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | UUID | auto | PK |
| invoiceNumber | string(20) | auto | Sequencial por usuario: {prefix}-0001. Prefix vem da Company.invoicePrefix |
| status | enum | yes | draft, sent, paid, cancelled (default: draft) |
| sentAt | timestamp | no | Timestamp de quando foi marcado como sent |
| paidAt | timestamp | no | Timestamp de quando foi marcado como paid |
| issueDate | date | yes | Data de emissao |
| dueDate | date | yes | Data de vencimento |
| currency | enum | yes | Herdado do client, editavel |
| description | text | yes | Descricao geral do servico prestado |
| notes | text | no | Observacoes internas (nao aparecem no PDF) |
| paymentInstructions | text | no | Instrucoes de pagamento (aparecem no PDF) |
| subtotal | decimal(12,2) | persisted | Soma dos line items — calculado no service, persistido no DB |
| extras | decimal(12,2) | persisted | Soma dos extras — calculado no service, persistido no DB |
| total | decimal(12,2) | persisted | subtotal + extras — calculado no service, persistido no DB |
| clientId | UUID | yes | FK → clients |
| userId | UUID | yes | FK → users (dono do invoice) |
| createdAt | timestamp | auto | |
| updatedAt | timestamp | auto | |

### InvoiceLineItem (servico principal)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | UUID | auto | PK |
| description | string(500) | yes | Descricao do servico |
| quantity | decimal(10,2) | yes | Horas ou unidades |
| unitPrice | decimal(12,2) | yes | Rate por hora/unidade |
| amount | decimal(12,2) | getter | quantity * unitPrice — getter na entity, sem coluna no DB |
| invoiceId | UUID | yes | FK → invoices |
| sortOrder | int | yes | Ordem de exibicao |
| createdAt | timestamp | auto | |
| updatedAt | timestamp | auto | |

### InvoiceExtra (rendas extras)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| id | UUID | auto | PK |
| description | string(500) | yes | Ex: "Bonus", "Reembolso viagem", "Equipment" |
| amount | decimal(12,2) | yes | Valor (positivo) |
| invoiceId | UUID | yes | FK → invoices |
| sortOrder | int | yes | Ordem de exibicao |
| createdAt | timestamp | auto | |
| updatedAt | timestamp | auto | |

### Company (migration — new field)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| invoicePrefix | string(10) | yes | Prefixo do invoice number (default: "INV"). Ex: "ACME", "JD" |

### Constraints

- Invoice pertence a exatamente 1 client e 1 user
- invoiceNumber e unico por usuario (UNIQUE(userId, invoiceNumber))
- Client com invoices NAO pode ser deletado — block delete, oferecer "inativar"
- Line items cascade delete com invoice
- Extras cascade delete com invoice
- Status transitions: draft → sent → paid, draft → cancelled, sent → cancelled
- dueDate >= issueDate
- lineItem.amount e getter (quantity * unitPrice) — sem coluna no DB
- invoice.subtotal, extras, total sao persistidos — recalculados no service em create/update

---

## User Stories

### P1: Criar invoice ⭐ MVP

**User Story**: As a contractor, I want to create an invoice for a client specifying services rendered and amounts so that I can bill them.

**Why P1**: Sem criacao de invoice, o app nao tem razao de existir.

**Acceptance Criteria**:

1. WHEN user navigates to create invoice page THEN system SHALL show a form with: client selector, issue date, due date, currency (defaulted from client), description, line items (description + quantity + unit price), extras (description + amount), and payment instructions
2. WHEN user selects a client THEN system SHALL pre-fill currency from client's preferred currency
3. WHEN user adds a line item THEN system SHALL auto-calculate amount (quantity * unitPrice) and update subtotal
4. WHEN user adds an extra THEN system SHALL update extras total and grand total
5. WHEN user submits valid form THEN system SHALL create invoice with status "draft" and auto-generated sequential number using company's invoicePrefix ({PREFIX}-0001)
6. WHEN invoice is created THEN system SHALL redirect to invoice detail page
7. WHEN user submits without required fields THEN system SHALL show field-level validation errors
8. WHEN user tries to create invoice for inactive/churned client THEN system SHALL allow it (contractor may need to bill for past work)

**Independent Test**: Create an invoice with 2 line items and 1 extra, verify number is auto-generated, totals are correct, status is draft.

---

### P1: Preview do invoice antes de criar ⭐ MVP

**User Story**: As a contractor, I want to preview how my invoice will look before creating it so I can catch mistakes early.

**Why P1**: Evita criar drafts errados que precisam ser editados ou cancelados.

**Acceptance Criteria**:

1. WHEN user fills in the invoice form THEN system SHALL show a live preview panel with the invoice layout (From/To/Items/Totals/Payment Instructions)
2. WHEN user changes form data THEN preview SHALL update in real-time
3. WHEN preview is shown THEN system SHALL display: company info (emissor), client info, line items table with amounts, extras, subtotal, extras total, grand total, and payment instructions
4. WHEN company data is incomplete (no bank info) THEN preview SHALL omit bank section
5. WHEN invoice has no extras THEN preview SHALL omit extras section

**Independent Test**: Fill in form with 2 line items and 1 extra, verify preview shows correct layout and totals update live.

---

### P1: Listar invoices ⭐ MVP

**User Story**: As a contractor, I want to see all my invoices in a searchable, paginated list so I can track billing status.

**Why P1**: Precisa ver o que ja foi faturado, o que esta pendente.

**Acceptance Criteria**:

1. WHEN user opens invoices page THEN system SHALL show paginated list (10/page) sorted by issueDate DESC
2. WHEN user types in search bar THEN system SHALL filter by invoiceNumber OR client fantasyName (case-insensitive, debounced)
3. WHEN user selects status filter THEN system SHALL filter by status
4. WHEN user selects client filter THEN system SHALL filter by client
5. WHEN user clicks a column header THEN system SHALL sort by that column
6. WHEN list is empty THEN system SHALL show empty state with CTA "Create your first invoice"
7. WHEN user clicks an invoice row THEN system SHALL navigate to invoice detail page

**Independent Test**: Create 3 invoices for different clients, verify list shows all 3, search by number, filter by status.

---

### P1: Ver detalhe do invoice ⭐ MVP

**User Story**: As a contractor, I want to see the full details of an invoice including line items and totals so I can review before sending.

**Why P1**: Precisa revisar o invoice antes de gerar PDF ou mudar status.

**Acceptance Criteria**:

1. WHEN user opens invoice detail THEN system SHALL show: invoice number, status badge, client info (name, email), dates, all line items with amounts, all extras, subtotal, extras total, grand total, payment instructions, and notes
2. WHEN invoice is in draft status THEN system SHALL show "Edit", "Mark as Sent", "Cancel", and "Download PDF" action buttons
3. WHEN invoice is in sent status THEN system SHALL show "Mark as Paid", "Cancel", and "Download PDF" action buttons
4. WHEN invoice is paid or cancelled THEN system SHALL show only "Download PDF" action button

**Independent Test**: Open a draft invoice, verify all data displays, verify correct action buttons per status.

---

### P1: Editar invoice ⭐ MVP

**User Story**: As a contractor, I want to edit a draft invoice to correct mistakes before sending.

**Why P1**: Erros em invoices sao comuns — precisa poder corrigir.

**Acceptance Criteria**:

1. WHEN user edits a draft invoice THEN system SHALL show pre-filled form with all current data
2. WHEN user changes line items or extras THEN system SHALL recalculate totals
3. WHEN user saves valid changes THEN system SHALL update the invoice and redirect to detail
4. WHEN user tries to edit a sent/paid/cancelled invoice THEN system SHALL block with message "Only draft invoices can be edited"
5. WHEN user changes client THEN system SHALL update currency to match new client (with option to keep current)

**Independent Test**: Edit a draft invoice, change a line item, verify totals update, verify redirect to detail.

---

### P1: Mudar status do invoice ⭐ MVP

**User Story**: As a contractor, I want to change the invoice status to track its lifecycle (draft → sent → paid).

**Why P1**: Tracking de status e essencial para saber o que foi pago.

**Acceptance Criteria**:

1. WHEN user marks draft as "Sent" THEN system SHALL update status to sent and record sentAt timestamp
2. WHEN user marks sent as "Paid" THEN system SHALL update status to paid and record paidAt timestamp
3. WHEN user cancels a draft or sent invoice THEN system SHALL update status to cancelled
4. WHEN user tries invalid transition (e.g., paid → draft) THEN system SHALL reject with error
5. WHEN status changes THEN system SHALL show confirmation dialog before proceeding

**Independent Test**: Create draft, mark sent, mark paid — verify each transition works and timestamps are recorded.

---

### P1: Gerar PDF do invoice ⭐ MVP

**User Story**: As a contractor, I want to download a professional PDF of my invoice to send to the client.

**Why P1**: PDF e o formato padrao de envio de invoice. Sem isso, o invoice nao tem como ser compartilhado.

**Acceptance Criteria**:

1. WHEN user clicks "Download PDF" THEN system SHALL generate a PDF with: emissor info (company data from Company entity), client info (name, address, email), invoice number, dates, line items table, extras table, totals, payment instructions
2. WHEN PDF is generated THEN system SHALL download directly to user's browser
3. WHEN user's company data is incomplete (no bank info) THEN system SHALL still generate PDF with available data (bank section omitted)
4. WHEN invoice has no extras THEN system SHALL omit extras section from PDF
5. PDF SHALL include: company logo placeholder (text-based header in v1), clear sections for From/To/Items/Totals/Payment

**Independent Test**: Generate PDF for invoice with line items + extras, verify all data is present and layout is professional.

---

### P1: Invoices no detalhe do cliente ⭐ MVP

**User Story**: As a contractor, I want to see invoice history when viewing a client so I know our billing relationship.

**Why P1**: A secao "Invoices" no detalhe do cliente ja existe vazia — precisa preencher com dados reais.

**Acceptance Criteria**:

1. WHEN user views client detail with invoices THEN system SHALL show list of invoices (number, date, status, total) sorted by issueDate DESC
2. WHEN user clicks an invoice in the list THEN system SHALL navigate to invoice detail
3. WHEN client has no invoices THEN system SHALL show "No invoices yet" with CTA to create one

**Independent Test**: Create 2 invoices for a client, verify they appear in client detail page.

---

### P1: Proteger delete de clientes ⭐ MVP

**User Story**: As a contractor, I want the system to prevent me from accidentally deleting a client that has invoices.

**Why P1**: Perder historico de invoices por um delete acidental e catastrofico.

**Acceptance Criteria**:

1. WHEN user tries to delete a client with invoices THEN system SHALL block the delete and show message "Cannot delete client with existing invoices. Archive the client instead."
2. WHEN user tries to delete a client with no invoices THEN system SHALL proceed normally (hard delete)
3. WHEN delete is blocked THEN system SHALL offer to change client status to "inactive" as alternative

**Independent Test**: Try to delete client with invoices — verify block. Delete client without invoices — verify success.

---

### P2: Duplicar invoice

**User Story**: As a contractor, I want to duplicate an existing invoice to quickly create a new one for the same client with similar services.

**Why P2**: Freelancers geralmente faturam o mesmo servico mensalmente. Duplicar economiza tempo.

**Acceptance Criteria**:

1. WHEN user clicks "Duplicate" on an invoice THEN system SHALL create a new draft with: same client, same line items, same extras, same payment instructions, new issue date (today), new due date (today + 30 days), new sequential number
2. WHEN duplicate is created THEN system SHALL redirect to the new invoice's edit page (so user can adjust before saving)

**Independent Test**: Duplicate an invoice, verify new draft has same data but new number and dates.

---

## Edge Cases

- WHEN user has no company data registered THEN system SHALL block invoice creation with message "Set up your company info before creating invoices"
- WHEN user creates first invoice THEN invoiceNumber SHALL be {PREFIX}-0001 (using Company.invoicePrefix, default "INV")
- WHEN user creates invoice after deleting previous ones THEN invoiceNumber SHALL continue sequence (no gaps reused)
- WHEN user changes invoicePrefix in company settings THEN new invoices SHALL use the new prefix, existing invoices keep their original number
- WHEN line item quantity is 0 THEN system SHALL reject with validation error
- WHEN line item unitPrice is 0 THEN system SHALL allow (pro-bono/courtesy items)
- WHEN dueDate < issueDate THEN system SHALL reject with validation error
- WHEN concurrent requests create invoices THEN system SHALL use DB-level uniqueness to prevent duplicate numbers

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| INV-01 | P1: Criar invoice | Tasks | In Tasks |
| INV-02 | P1: Preview do invoice | Tasks | In Tasks |
| INV-03 | P1: Listar invoices | Tasks | In Tasks |
| INV-04 | P1: Ver detalhe | Tasks | In Tasks |
| INV-05 | P1: Editar invoice | Tasks | In Tasks |
| INV-06 | P1: Mudar status | Tasks | In Tasks |
| INV-07 | P1: Gerar PDF | Tasks | In Tasks |
| INV-08 | P1: Invoices no cliente | Tasks | In Tasks |
| INV-09 | P1: Proteger delete clientes | Tasks | In Tasks |
| INV-10 | P2: Duplicar invoice | Tasks | In Tasks |

**Coverage:** 10 total, 10 mapped to tasks, 0 unmapped

---

## Security

- All endpoints protected by JwtAuthGuard (global, existing)
- userId injected from JWT via @CurrentUser(), never from request body
- All inputs validated via Zod schemas (shared package)
- No user enumeration: 404 for other users' invoices/clients
- Rate limiting: default global (60/60s)
- PDF generation server-side only — no client-side rendering of sensitive data
- Invoice numbers sequential per user — no cross-user leakage

## Decisions (resolved gray areas)

### GA1: PDF generation → PDFKit (server-side)
Leve, sem dependencia de browser headless, controle total do layout. Serverless-friendly.

### GA2: Invoice number → Prefixo customizavel desde v1
Campo `invoicePrefix` na Company entity (default "INV"). Format: `{PREFIX}-{0001}`. Sequencia numerica e global por usuario (nao reseta com mudanca de prefixo).

### GA3: Campos computados → Hibrido
- `lineItem.amount` → **getter na entity** (self-contained: `quantity * unitPrice`, sem coluna no DB)
- `invoice.subtotal`, `invoice.extras`, `invoice.total` → **persistidos no DB**, recalculados no service em create/update. Permite ordenar/filtrar invoices por total.

### GA4: Client delete protection → Block delete + oferecer inativar
Sem soft delete. Client com invoices nao pode ser deletado — backend retorna 409 Conflict com mensagem sugerindo inativar.

---

## Success Criteria

- [ ] User can create invoice with line items + extras, verify auto-number and computed totals
- [ ] User can view, edit, and transition invoice through full lifecycle (draft → sent → paid)
- [ ] User can download professional PDF with all invoice data + company/client info
- [ ] Client detail page shows real invoice history
- [ ] Client with invoices cannot be deleted
- [ ] All data isolated by user — no cross-user access
