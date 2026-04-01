# Invoice Feature — Security Review

**Date**: 2026-04-01
**Scope**: Design review da feature de invoices (pre-implementation)
**Skills applied**: security-threat-model, security-best-practices

---

## Executive Summary

A feature de invoices introduce superficies novas: PDF generation server-side, state machine de status, numeracao sequencial, e uma nova dependencia (PDFKit). Os riscos principais sao: race conditions na geracao de invoice numbers, IDOR no download de PDF, e potencial DoS via PDF generation. A dependencia PDFKit e segura (0 vulns, mantida ativamente, supply chain limpa).

---

## Dependency Assessment: PDFKit

| Field | Value |
|-------|-------|
| Package | `pdfkit` v0.18.0 |
| Last published | 2026-03-15 |
| Known vulns | **0** (npm audit + Snyk clean) |
| Maintainers | 4 (foliojs org) |
| Dependencies | 6 (small tree, reputable: `@noble/ciphers`, `@noble/hashes`, `fontkit`, etc.) |
| Supply chain | No incidents. Migrou de `crypto-js` pra `@noble/*` (melhoria proativa) |
| CVEs confusos | CVE-2022-25765 (Ruby gem, nao npm), CVE-2025-26240 (Python, nao npm) |

**Verdict**: Safe to use. Pinnar versao no package.json.

---

## Threat Analysis (feature-specific)

### TM-001: Race condition na geracao de invoice number

- **Likelihood**: Medium — usuario unico normalmente nao faz requests concorrentes, mas tabs multiplas ou double-click podem
- **Impact**: Low — numeros duplicados causam erro 409, nao perda de dados
- **Existing control**: UNIQUE(userId, invoiceNumber) constraint no DB
- **Gap**: Se o service faz SELECT MAX + INSERT sem lock, dois requests podem calcular o mesmo numero
- **Mitigation**: Retry com numero incrementado se UNIQUE violation. Ou usar `SERIALIZABLE` isolation level no trecho de numeracao
- **Priority**: Low (constraint DB previne duplicata, retry resolve)

### TM-002: IDOR no download de PDF

- **Likelihood**: Medium — atacante pode tentar acessar `/invoices/:id/pdf` de outro usuario
- **Impact**: High — exposicao de dados financeiros (valores, dados bancarios, CNPJ)
- **Existing control**: `@CurrentUser()` + ownership check (userId filter) — mesmo padrao do CRM clients
- **Gap**: Nenhum se implementado corretamente (404 pra IDs de outro usuario)
- **Mitigation**: Garantir que `findOne()` filtra por userId antes de gerar PDF. Nunca expor endpoint publico
- **Priority**: High (impacto alto, mas controle existente e suficiente se aplicado)

### TM-003: DoS via PDF generation

- **Likelihood**: Low — rate limit global (60/60s) ja limita, e geracao de PDF e lightweight com PDFKit
- **Impact**: Medium — consumo de CPU/memoria se muitas requests simultaneas
- **Existing control**: ThrottlerGuard global (60 req/60s)
- **Gap**: PDF generation pode ser mais pesado que CRUD normal
- **Mitigation**: Rate limit especifico menor no endpoint de PDF (ex: 10/60s). Limitar tamanho de line items/extras no schema (max 50 items)
- **Priority**: Low (PDFKit e leve, rate limit global ja protege)

### TM-004: Decimal precision / financial integrity

- **Likelihood**: Low — TypeORM com `decimal(12,2)` no PostgreSQL garante precisao
- **Impact**: Medium — totais errados em invoices financeiros
- **Existing control**: PostgreSQL `decimal` type
- **Gap**: TypeORM retorna decimal como `string`. Converter com `Number()` pode perder precisao em valores muito grandes
- **Mitigation**: Converter com `parseFloat()` ou `Number()` (seguro ate 15 digitos, suficiente pra 12,2). Testar com valores limite
- **Priority**: Low (decimal(12,2) comporta ate 9,999,999,999.99 — mais que suficiente)

### TM-005: Invoice status transition bypass

- **Likelihood**: Low — atacante precisaria adivinhar transitions validas
- **Impact**: Medium — marcar invoice como paid sem ter sido enviado
- **Existing control**: State machine no service valida transitions
- **Gap**: Se validacao for feita so no frontend, backend aceita qualquer status
- **Mitigation**: State machine MUST ser enforced no backend (InvoicesService). Frontend mostra so botoes validos como UX, nao como seguranca
- **Priority**: Medium (precisa garantir enforcement no backend)

### TM-006: Client delete bypass via direct DB access

- **Likelihood**: Very Low — requer acesso direto ao DB
- **Impact**: High — perda de dados de invoices
- **Existing control**: Client FK com `onDelete: RESTRICT` no entity
- **Gap**: Nenhum — DB constraint e o enforcement final
- **Priority**: Low (DB constraint e suficiente)

---

## Security Checklist for Implementation

### Backend

- [ ] Todos endpoints de invoices usam `@CurrentUser()` — nunca aceitar userId do request body
- [ ] `findOne()`, `update()`, `updateStatus()`, PDF download — todos filtram por userId
- [ ] 404 (nao 403) pra invoices de outro usuario
- [ ] State machine de status enforced no service (nao so no frontend)
- [ ] Invoice number UNIQUE constraint no DB como safety net
- [ ] PDF generation: nao aceitar user input como paths de arquivo ou templates
- [ ] Zod validation em todos os endpoints (schemas do shared)
- [ ] Line items: max 50 items pra prevenir abuse
- [ ] Extras: max 20 items
- [ ] Client FK com `onDelete: RESTRICT`
- [ ] Rate limit no endpoint de PDF (considerar limite menor que o global)

### Frontend

- [ ] Sem `dangerouslySetInnerHTML` no InvoicePreview
- [ ] Currency formatting via `Intl.NumberFormat` (safe, no XSS risk)
- [ ] PDF download via blob URL — nao expor dados em DOM
- [ ] Tratar erro 409 do backend gracefully (client delete blocked, status transition invalid)

### Dependency

- [ ] Pinnar `pdfkit` version exata no package.json
- [ ] Adicionar `pnpm audit` no CI (se nao ja existe)

---

## Recommendations Summary

| Priority | Action |
|----------|--------|
| High | Garantir ownership check (userId filter) em TODOS os endpoints de invoice, especialmente PDF download |
| Medium | Enforce state machine no backend, nao confiar no frontend |
| Medium | Limitar max line items (50) e extras (20) nos Zod schemas |
| Low | Considerar rate limit menor no endpoint de PDF |
| Low | Implementar retry pra UNIQUE violation no invoice number |
