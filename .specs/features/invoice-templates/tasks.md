# Invoice Templates — Tasks

**Feature:** Invoice Templates
**Design:** design.md
**Status:** COMPLETE

---

## Tasks

### T1 — Backend: tipos e registry

**Files:**
- `packages/api/src/invoices/templates/template.types.ts` (new)
- `packages/api/src/invoices/templates/template.registry.ts` (new)

**Steps:**
1. Criar `template.types.ts` com `InvoiceTemplate` enum (`classic`, `modern`, `minimal`) e `TemplateFunction` type
2. Criar `template.registry.ts` com `Map<InvoiceTemplate, TemplateFunction>` e função `getTemplate(name)`

**Verification:** TypeScript compila sem erros

---

### T2 — Backend: classic template (extração)

**Depends on:** T1
**Files:**
- `packages/api/src/invoices/templates/classic.template.ts` (new)
- `packages/api/src/invoices/pdf.service.ts` (refactor)

**Steps:**
1. Extrair lógica de `PdfService.renderPdf()` para `classic.template.ts` como `classicTemplate: TemplateFunction`
2. Refatorar `PdfService.generate()` para usar `getTemplate(invoice.template ?? InvoiceTemplate.CLASSIC)`
3. Remover método `renderPdf()` do PdfService

**Verification:** Download de PDF existente gera layout idêntico ao anterior (sem regressão visual)

---

### T3 — DB: migration + entity update

**Depends on:** T1
**Files:**
- `packages/api/src/invoices/entities/invoice.entity.ts`
- `packages/api/src/company/company.entity.ts`
- `packages/api/src/migrations/` (new migration file)

**Steps:**
1. Adicionar campo `template: InvoiceTemplate` na `Invoice` entity (default `classic`)
2. Adicionar campo `defaultTemplate: InvoiceTemplate | null` na `Company` entity (default `classic`, nullable)
3. Gerar migration TypeORM
4. Verificar migration SQL antes de rodar

**Verification:** Migration roda sem erros; colunas existem no DB; invoices existentes têm `template = 'classic'`

---

### T4 — Shared: schema + types update

**Depends on:** T1
**Files:**
- `packages/shared/src/schemas/invoices.ts`
- `packages/shared/src/types/invoices.ts`
- `packages/shared/src/types/company.ts`

**Steps:**
1. Adicionar `invoiceTemplateSchema = z.enum(['classic', 'modern', 'minimal'])` em `schemas/invoices.ts`
2. Adicionar campo `template` opcional (default `classic`) em `createInvoiceSchema` e `updateInvoiceSchema`
3. Adicionar campo `template: InvoiceTemplateType` em `InvoiceDetail` type
4. Adicionar campo `defaultTemplate: InvoiceTemplateType | null` em `CompanyResponse` type

**Verification:** `pnpm -w tsc --noEmit` passa sem erros

---

### T5 — Backend: modern + minimal templates

**Depends on:** T2
**Files:**
- `packages/api/src/invoices/templates/modern.template.ts` (new)
- `packages/api/src/invoices/templates/minimal.template.ts` (new)
- `packages/api/src/invoices/templates/template.registry.ts` (update)

**Steps:**
1. Implementar `modern.template.ts`:
   - Header com banda de cor sólida (azul escuro `#1e3a5f`) ocupando ~80px no topo
   - Nome da empresa em branco sobre a banda, invoice number em destaque
   - Tabela de serviços com header colorido (mesma cor da banda, texto branco)
   - Totais em box com fundo cinza claro
2. Implementar `minimal.template.ts`:
   - Sem linhas ou bordas — separadores por espaçamento (16-24pt entre seções)
   - Fonte base maior (11pt vs 10pt do classic)
   - Totais alinhados à direita sem box
   - Paleta monocromática: preto `#000000` e cinza `#666666`
3. Registrar ambos no `template.registry.ts`

**Verification:** Baixar PDF com cada template; verificar layout renderiza corretamente sem erros

---

### T6 — Backend: usar defaultTemplate na criação de invoice

**Depends on:** T3, T4
**Files:**
- `packages/api/src/invoices/invoices.service.ts`

**Steps:**
1. No método `create()`, se `template` não fornecido no input, buscar `company.defaultTemplate` e usar como fallback (antes do default `classic`)

**Verification:** Criar invoice sem `template` no body — verifica que usa `defaultTemplate` da company

---

### T7 — Frontend: campo template no InvoiceForm

**Depends on:** T4
**Files:**
- `packages/web/src/features/invoices/components/InvoiceForm.tsx`
- `packages/web/src/features/invoices/api/invoices.api.ts` (verificar se já passa `template`)

**Steps:**
1. Adicionar campo `template` no schema/defaultValues do form (default `'classic'`)
2. Adicionar `<Select>` com opções: Classic, Modern, Minimal
3. Posicionar o campo no form (sugestão: próximo aos campos de datas ou no topo)
4. Verificar que `template` é enviado no payload de create e update

**Verification:** Criar invoice com template `modern`; baixar PDF; confirmar que usa layout modern

---

### T8 — Testes

**Depends on:** T2, T5, T6
**Files:**
- `packages/api/src/invoices/pdf.service.spec.ts` (new ou update)
- `packages/api/test/invoices/` (integration tests update)

**Steps:**
1. Unit test: `PdfService.generate()` com cada template gera buffer não-vazio
2. Unit test: `getTemplate('invalid')` lança erro
3. Integration test: `GET /invoices/:id/pdf` retorna `Content-Type: application/pdf`
4. Integration test: `POST /invoices` com `template: 'modern'` persiste o campo corretamente

**Verification:** `pnpm --filter api test:unit` e `pnpm --filter api test:integration` passam

---

## Dependency Graph

```
T1 (tipos/registry)
├── T2 (classic + refactor PdfService)
│   └── T5 (modern + minimal templates)
│       └── T8 (testes)
├── T3 (DB migration)
│   └── T6 (defaultTemplate no create)
└── T4 (shared schemas)
    ├── T6
    └── T7 (frontend form)
```

**Paralelizável após T1:** T2, T3, T4 podem rodar em paralelo.
**Paralelizável após T2+T3+T4:** T5, T6, T7 podem rodar em paralelo.
**T8** fecha tudo.
