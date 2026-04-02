# Invoice Templates — Design

**Feature:** Invoice Templates
**Spec:** spec.md
**Status:** DESIGNED

---

## Architecture Overview

Introduzir um template registry como camada de indireção entre `PdfService` e as funções de renderização. Cada template é uma função pura PDFKit. `PdfService.generate()` delega para o template correto via registry.

```
InvoicesController
    ↓
PdfService.generate(invoice, company)           ← API pública inalterada
    ↓
TemplateRegistry.get(invoice.template)
    ↓
TemplateFunction(doc, invoice, company)         ← rendering logic por template
    ↓
Buffer
```

---

## Backend

### Novos arquivos

```
packages/api/src/invoices/
├── pdf.service.ts                    # Refatorado — delega ao registry
└── templates/
    ├── template.types.ts             # InvoiceTemplate enum + TemplateFunction type
    ├── template.registry.ts          # Map<InvoiceTemplate, TemplateFunction>
    ├── classic.template.ts           # Layout atual extraído do PdfService
    ├── modern.template.ts            # Sidebar colorida, tipografia diferente
    └── minimal.template.ts           # Whitespace-first, sem bordas
```

### `template.types.ts`

```typescript
import type PDFDocument from 'pdfkit'
import type { InvoiceDetail } from '@qcontabil/shared'
import type { CompanyResponse } from '@qcontabil/shared'

export type PdfDoc = InstanceType<typeof PDFDocument>

export type TemplateFunction = (
  doc: PdfDoc,
  invoice: InvoiceDetail,
  company: CompanyResponse,
) => void

export enum InvoiceTemplate {
  CLASSIC = 'classic',
  MODERN = 'modern',
  MINIMAL = 'minimal',
}
```

### `template.registry.ts`

```typescript
import { InvoiceTemplate, TemplateFunction } from './template.types'
import { classicTemplate } from './classic.template'
import { modernTemplate } from './modern.template'
import { minimalTemplate } from './minimal.template'

const registry = new Map<InvoiceTemplate, TemplateFunction>([
  [InvoiceTemplate.CLASSIC, classicTemplate],
  [InvoiceTemplate.MODERN, modernTemplate],
  [InvoiceTemplate.MINIMAL, minimalTemplate],
])

export function getTemplate(name: InvoiceTemplate): TemplateFunction {
  const fn = registry.get(name)
  if (!fn) throw new Error(`Unknown invoice template: ${name}`)
  return fn
}
```

### `pdf.service.ts` refatorado

```typescript
async generate(invoice: InvoiceDetail, company: CompanyResponse): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  const templateFn = getTemplate(invoice.template ?? InvoiceTemplate.CLASSIC)
  templateFn(doc, invoice, company)
  doc.end()
  return streamToBuffer(doc)
}
```

### DB Changes

**Invoice entity — novo campo:**
```typescript
@Column({
  type: 'enum',
  enum: InvoiceTemplate,
  default: InvoiceTemplate.CLASSIC,
  comment: 'PDF template used to render this invoice',
})
template: InvoiceTemplate
```

**Company entity — novo campo (P1):**
```typescript
@Column({
  type: 'enum',
  enum: InvoiceTemplate,
  default: InvoiceTemplate.CLASSIC,
  nullable: true,
  comment: 'Default PDF template for new invoices',
})
defaultTemplate: InvoiceTemplate | null
```

**Migration:** Adicionar coluna `template` em `invoices` e `default_template` em `companies`.

### Novos endpoints

Nenhum. Preview de template adiado para futuro.

### Shared — novo schema/type

```typescript
// packages/shared/src/schemas/invoices.ts
export const invoiceTemplateSchema = z.enum(['classic', 'modern', 'minimal'])
export type InvoiceTemplateType = z.infer<typeof invoiceTemplateSchema>
```

Adicionar `template` em `createInvoiceSchema`, `updateInvoiceSchema`, `InvoiceDetail`.

---

## Template Designs

### classic.template.ts
Extração direta do `PdfService.renderPdf()` atual. Zero regressão visual. Layout existente preservado.

### modern.template.ts
- Header com banda de cor sólida (azul/cinza escuro) ocupando ~20% topo da página
- Nome da empresa em branco sobre a banda
- Invoice number em destaque (fonte maior)
- Tabela de serviços com header colorido (mesma cor da banda)
- Totais em box com fundo

### minimal.template.ts
- Sem linhas ou bordas na tabela — separadores apenas por espaçamento
- Tipografia maior, mais espaçamento entre seções
- Totais alinhados à direita sem box
- Paleta monocromática (preto e cinza)

---

## Frontend

### Novo campo no formulário (InvoiceForm.tsx)

Select com 3 opções: Classic, Modern, Minimal. Sem preview — adiado para futuro.

### Componentes novos/modificados

| Componente | Mudança |
|-----------|---------|
| `InvoiceForm.tsx` | Adicionar campo `template` (select com 3 opções: Classic, Modern, Minimal) |

---

## Sequência de implementação

1. **Backend — tipos e registry** (`template.types.ts`, `template.registry.ts`)
2. **Backend — classic template** (extrair renderPdf atual para `classic.template.ts`)
3. **Backend — refatorar PdfService** (usar registry)
4. **DB migration** (coluna `template` em invoices, `default_template` em companies)
5. **Shared — schema update** (adicionar `template` em schemas e types)
6. **Backend — modern + minimal templates** (novos layouts PDFKit)
7. **Frontend — InvoiceForm update** (campo template select)

---

## Riscos

- **Regressão no classic:** extração do renderPdf deve ser equivalente ao layout atual — testar side-by-side com o PDF gerado antes do refactor
