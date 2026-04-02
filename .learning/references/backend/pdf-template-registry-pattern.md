# PDF Template Registry Pattern (PDFKit)

## Context

Feature: Invoice Templates — M3 do roadmap qcontabil.

Precisávamos suportar múltiplos layouts de PDF (classic, modern, minimal) sem transformar o `PdfService` em um monólito condicional. A solução foi um registry que mapeia enum → função de renderização.

## Pattern

### Arquitetura

```
PdfService.generate(invoice, company)
    ↓
getTemplate(invoice.template)      ← registry lookup
    ↓
templateFn(doc, invoice, company)  ← pure render function
    ↓
Buffer
```

Cada template é uma função pura: recebe o `PDFDocument` já criado + dados, renderiza, não retorna nada.

### Tipos centrais

```typescript
// template.types.ts
export enum InvoiceTemplate {
  CLASSIC = 'classic',
  MODERN = 'modern',
  MINIMAL = 'minimal',
}

export type PdfDoc = PDFKit.PDFDocument

export type TemplateFunction = (
  doc: PdfDoc,
  invoice: InvoiceDetail,
  company: CompanyResponse | null,
) => void
```

### Registry

```typescript
// template.registry.ts
const registry = new Map<InvoiceTemplate, TemplateFunction>([
  [InvoiceTemplate.CLASSIC, classicTemplate],
  [InvoiceTemplate.MODERN, modernTemplate],
  [InvoiceTemplate.MINIMAL, minimalTemplate],
])

export function getTemplate(name: InvoiceTemplate): TemplateFunction {
  const fn = registry.get(name)
  if (!fn) throw new Error(`Template not registered: ${name}`)
  return fn
}
```

### PdfService simplificado

```typescript
async generate(invoice: InvoiceDetail, company: CompanyResponse | null): Promise<Buffer> {
  const templateFn = getTemplate(invoice.template ?? InvoiceTemplate.CLASSIC)
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const pass = new PassThrough()
    const chunks: Buffer[] = []
    pass.on('data', (chunk: Buffer) => chunks.push(chunk))
    pass.on('end', () => resolve(Buffer.concat(chunks)))
    pass.on('error', reject)
    doc.pipe(pass)
    templateFn(doc, invoice, company)
    doc.end()
  })
}
```

## Benefícios

- **Adicionar template = 1 arquivo + 1 linha no registry** — zero mudança no PdfService
- **Templates são funções puras** — fáceis de testar isoladamente
- **Erro explícito** se template não registrado (fail-fast)

## Extensão

Para adicionar um novo template `detailed`:
1. Criar `detailed.template.ts` exportando `detailedTemplate: TemplateFunction`
2. Adicionar `InvoiceTemplate.DETAILED = 'detailed'` ao enum
3. Registrar no Map: `[InvoiceTemplate.DETAILED, detailedTemplate]`

Nada mais muda.
