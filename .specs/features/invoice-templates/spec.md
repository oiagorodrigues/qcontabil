# Invoice Templates

**Milestone:** M3 — Automação + Dashboard
**Scope:** Medium
**Status:** SPECIFIED

---

## Overview

Templates pré-definidos de PDF para invoices. O contractor seleciona um template ao criar/editar invoice. Preview antes de aplicar. 2-3 layouts diferentes no v1.

## Actors

- **Contractor** — seleciona template para seus invoices

## Preconditions

- PdfService já gera PDFs via PDFKit server-side
- Invoice entity e CRUD completos (M2)

---

## Requirements

### Template Registry

| ID | Requirement | Priority |
|----|-------------|----------|
| TPL-01 | Enum de templates disponíveis: `classic`, `modern`, `minimal` | P0 |
| TPL-02 | Cada template é uma função PDFKit que recebe `InvoiceDetail + Company` e retorna PDF buffer | P0 |
| TPL-03 | Template `classic` = layout atual (refatorar PdfService existente) | P0 |
| TPL-04 | Template `modern` = layout com sidebar colorida, tipografia diferente | P0 |
| TPL-05 | Template `minimal` = layout limpo, sem bordas, foco em whitespace | P0 |

### Invoice-Template Association

| ID | Requirement | Priority |
|----|-------------|----------|
| TPL-06 | Invoice armazena: `template` (enum, default `classic`) | P0 |
| TPL-07 | Campo de seleção de template no formulário de create/edit invoice | P0 |
| TPL-08 | Company armazena: `defaultTemplate` (enum, default `classic`) — template padrão para novos invoices | P1 |

### Preview

| ID | Requirement | Priority |
|----|-------------|----------|
| TPL-09 | Preview de template — adiado para futuro | DEFERRED |
| TPL-10 | Preview no formulário — adiado para futuro | DEFERRED |
| TPL-11 | Preview em Settings — adiado para futuro | DEFERRED |

### PDF Generation (Refactor)

| ID | Requirement | Priority |
|----|-------------|----------|
| TPL-12 | Refatorar `PdfService` para usar template registry — delega geração para a função do template selecionado | P0 |
| TPL-13 | `downloadPdf` endpoint usa o template salvo no invoice | P0 |

---

## Out of Scope

- Editor visual de templates (drag & drop, WYSIWYG)
- Templates customizados pelo usuário (criar do zero)
- Upload de logo no template (usar dados da Company existentes)
- Marketplace de templates
- Preview de template (client-side ou server-side) — adiado para futuro

## Design Notes

- Templates são código PDFKit, não configuração dinâmica
- Adicionar novos templates = adicionar nova função + registrar no enum
