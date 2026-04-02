# Payment Integration

**Milestone:** M3 — Automação + Dashboard
**Scope:** Large
**Status:** SPECIFIED

---

## Overview

Integrar envio de invoices com plataforma de pagamento (Tipalti v1) via camada de abstração `PaymentProvider`. O contractor pode enviar invoice manualmente (botão) ou configurar envio automático em dia do mês. Tracking de status via webhooks.

## Actors

- **Contractor** — usuário do qcontabil (BR, PJ)
- **Client** — empresa estrangeira que recebe o invoice (precisa ter conta Tipalti)

## Preconditions

- Invoice existe com status `draft` ou `sent`
- Company tem dados bancários preenchidos
- Client tem configuração de payment provider (Tipalti payee ID)

---

## Requirements

### Payment Provider Abstraction

| ID | Requirement | Priority |
|----|-------------|----------|
| PAY-01 | Interface `PaymentProvider` com métodos: `submitInvoice`, `getInvoiceStatus`, `cancelInvoice`, `validateConnection` | P0 |
| PAY-02 | Implementação `TipaltiProvider` que integra com API REST do Tipalti | P0 |
| PAY-03 | Configuração do provider via env vars (API key, payer entity, sandbox/prod URL) | P0 |
| PAY-04 | Factory/registry para instanciar o provider correto por nome | P0 |

### Payment Provider Configuration (Company-level)

| ID | Requirement | Priority |
|----|-------------|----------|
| PAY-05 | Company armazena: `paymentProvider` (enum: `tipalti`), `paymentProviderConfig` (JSON encrypted — API credentials) | P0 |
| PAY-06 | Tela de configuração em Settings para o contractor configurar credenciais do provider | P0 |
| PAY-07 | Botão "Test Connection" que valida as credenciais via `validateConnection` | P1 |

### Client Payment Config

| ID | Requirement | Priority |
|----|-------------|----------|
| PAY-08 | Client armazena: `paymentProviderPayeeId` (string, nullable) — ID do cliente na plataforma de pagamento | P0 |
| PAY-09 | Campo no formulário de client para configurar o payee ID | P0 |

### Invoice Submission (Manual)

| ID | Requirement | Priority |
|----|-------------|----------|
| PAY-10 | Botão "Send via Payment Platform" no invoice detail (status `draft` ou `sent`) | P0 |
| PAY-11 | Ao clicar, chama `PaymentProvider.submitInvoice` com dados do invoice + PDF | P0 |
| PAY-12 | Invoice muda status para `sent`, registra `sentAt` e `paymentProviderRef` (ID externo) | P0 |
| PAY-13 | Se client não tem `paymentProviderPayeeId`, botão desabilitado com tooltip explicativo | P0 |
| PAY-14 | Se company não tem provider configurado, botão desabilitado com link para Settings | P0 |
| PAY-15 | Fallback: botão "Send via Email" envia PDF por email para contatos do client (funciona sem provider) | P1 |

### Invoice Submission (Automático)

| ID | Requirement | Priority |
|----|-------------|----------|
| PAY-16 | Client armazena: `autoSendDay` (1-28, nullable) — dia do mês para envio automático | P0 |
| PAY-17 | Campo no formulário de client para configurar dia de envio automático | P0 |
| PAY-18 | Cron job diário verifica invoices em `draft` com `issueDate` <= hoje e client com `autoSendDay` = dia atual | P0 |
| PAY-19 | Cron submete invoice via `PaymentProvider.submitInvoice` e atualiza status | P0 |
| PAY-20 | Log de execução do cron com resultado por invoice (sucesso/falha) | P1 |

### Status Tracking

| ID | Requirement | Priority |
|----|-------------|----------|
| PAY-21 | Invoice armazena: `paymentProviderRef` (string, nullable) — referência externa | P0 |
| PAY-22 | Invoice armazena: `paymentProviderStatus` (string, nullable) — status raw do provider | P0 |
| PAY-23 | Webhook endpoint `POST /api/webhooks/tipalti` recebe notificações de status | P0 |
| PAY-24 | Webhook mapeia status do Tipalti para status do invoice (`paid`, etc.) e atualiza automaticamente | P0 |
| PAY-25 | Webhook valida assinatura/secret do Tipalti antes de processar | P0 |
| PAY-26 | Exibir `paymentProviderStatus` no invoice detail como badge secundário | P1 |

### Notificações

| ID | Requirement | Priority |
|----|-------------|----------|
| PAY-27 | Enviar email ao contractor quando invoice é marcado como `paid` via webhook | P1 |
| PAY-28 | Notificação in-app (badge/toast) quando status muda via webhook | P2 |

---

## Status Transitions (Atualizado)

```
draft → sent (manual button OR auto-send cron)
draft → cancelled
sent → paid (manual OR webhook)
sent → cancelled
paid → (terminal)
cancelled → (terminal)
```

## Out of Scope

- Orquestração de pagamento (mover dinheiro) — qcontabil apenas submete invoice
- Múltiplos providers simultâneos por company
- Invoices recorrentes (criação automática)
- Reconciliação bancária
- UI para gerenciar webhooks

## Riscos

- **Tipalti API access:** requer aprovação comercial, pricing enterprise opaco
- **Sandbox:** verificar se Tipalti oferece sandbox gratuito para dev/test
- **Webhook reliability:** precisa de retry/idempotency no handler
- **Credentials storage:** `paymentProviderConfig` deve ser encrypted at rest
