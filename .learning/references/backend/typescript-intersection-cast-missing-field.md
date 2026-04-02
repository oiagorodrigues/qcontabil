# TypeScript: Intersection Cast para Campos Ausentes no Tipo

## Contexto

Durante o desenvolvimento incremental da feature Invoice Templates, o `PdfService` precisava acessar `invoice.template` antes que o campo fosse adicionado ao tipo `InvoiceDetail` (shared package). T2 (PdfService) e T4 (shared types) eram paralelos.

## Problema

`InvoiceDetail` ainda não tinha `template`. Acesso direto causava erro TypeScript:

```typescript
// ❌ TS error: Property 'template' does not exist on type 'InvoiceDetail'
invoice.template ?? InvoiceTemplate.CLASSIC
```

Usar `any` violava o padrão do projeto (never `any`).

## Solução: Intersection Cast

```typescript
// ✅ Sem any — intersection type temporário
const templateName =
  (invoice as InvoiceDetail & { template?: InvoiceTemplate }).template ??
  InvoiceTemplate.CLASSIC
```

O cast `as InvoiceDetail & { template?: InvoiceTemplate }` diz ao TypeScript: "trate este valor como InvoiceDetail _mais_ esse campo opcional extra". Quando T4 adicionou `template` ao `InvoiceDetail`, o cast tornou-se redundante e foi removido.

## Quando usar

- Desenvolvimento paralelo de tasks com dependências soltas (tipo ainda não existe, mas o runtime já tem o campo)
- Campos que serão adicionados em breve ao tipo oficial
- **Nunca** como solução permanente — deve ser removido quando o tipo for atualizado

## Não confundir com

```typescript
// ❌ Errado — usa any, perde type safety completamente
(invoice as any).template

// ✅ Correto — preserva type safety do restante de InvoiceDetail
(invoice as InvoiceDetail & { template?: InvoiceTemplate }).template
```
