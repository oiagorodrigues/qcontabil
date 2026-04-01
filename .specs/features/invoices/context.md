# Invoice Generation — Context (User Decisions)

**Spec**: `.specs/features/invoices/spec.md`
**Date**: 2026-04-01

---

## Resolved Gray Areas

### GA1: PDF generation approach
**Decision**: Server-side com PDFKit
**Rationale**: Leve, sem dependência de Chrome headless, controle total do layout, serverless-friendly.
**Alternatives considered**: Puppeteer (pesado), client-side jsPDF (dados sensíveis expostos).

### GA2: Invoice number format
**Decision**: Prefixo customizável desde v1
**Details**: Campo `invoicePrefix` na Company entity (default "INV"). Format: `{PREFIX}-{0001}`.
**User request**: "invoice number pode ser prefixado pelo usuario desde o começo"
**Implementation**: Sequência numérica global por usuário (não reseta com mudança de prefixo). Invoices existentes mantêm número original.

### GA3: Computed fields strategy
**Decision**: Híbrido — getters para line items, persistido para invoice totals
**User question**: "o django define getters para esses campos. Seria possível fazer o mesmo?"
**Details**:
- `lineItem.amount` → getter na entity (`get amount() { return this.quantity * this.unitPrice }`)
- `invoice.subtotal`, `extras`, `total` → persistidos no DB, recalculados no service em create/update
**Rationale**: Line item amount é self-contained (sem relations). Invoice totals precisam ser persistidos para suportar ORDER BY/filter na listagem.

### GA5: Invoice preview before creation
**Decision**: Client-side preview (componente React)
**Details**: Componente `InvoicePreview` renderiza layout do invoice em tempo real com dados do form. Reutilizável no detalhe do invoice. Sem request ao server.
**Rationale**: Zero custo de server, instantâneo. PDF exato disponível após criar o draft. Se fidelidade pixel-perfect virar prioridade, pode adicionar endpoint `POST /invoices/preview` como complemento.

### GA4: Client delete protection
**Decision**: Block delete + oferecer inativar (sem soft delete)
**Details**: Backend retorna 409 Conflict quando client tem invoices. Frontend mostra mensagem sugerindo mudar status para "inactive".
**Rationale**: Sem complexidade de soft delete infrastructure.
