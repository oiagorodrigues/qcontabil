# Payment Integration Design

**Spec**: `spec.md`
**Status**: Draft

---

## Architecture Overview

Camada de abstração `PaymentProvider` com adapter pattern. A interface define o contrato; `TipaltiProvider` é o primeiro adapter. O módulo `PaymentsModule` orquestra tudo: envio manual, cron de envio automático, webhook receiver.

Credenciais do provider são armazenadas encrypted na Company entity. Cada client pode ter um `paymentProviderPayeeId` e `autoSendDay`.

```
┌─────────────────────────────────────────────────────────────┐
│ PaymentsModule                                               │
│                                                              │
│  PaymentsController                                          │
│  ├─ POST /payments/send/:invoiceId    (manual send)          │
│  ├─ GET  /payments/status/:invoiceId  (check status)         │
│  └─ POST /payments/test-connection    (validate credentials) │
│                                                              │
│  WebhookController                                           │
│  └─ POST /webhooks/tipalti            (status updates)       │
│                                                              │
│  PaymentsService                                             │
│  ├─ submitInvoice()                                          │
│  ├─ checkStatus()                                            │
│  ├─ handleWebhook()                                          │
│  └─ processAutoSend()  ← Cron                               │
│                                                              │
│  PaymentProviderFactory                                      │
│  └─ create(config) → PaymentProvider                         │
│                                                              │
│  Providers                                                   │
│  └─ TipaltiProvider implements PaymentProvider               │
│     ├─ submitInvoice()                                       │
│     ├─ getInvoiceStatus()                                    │
│     ├─ cancelInvoice()                                       │
│     └─ validateConnection()                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
|-----------|----------|------------|
| Invoice entity | `api/src/invoices/entities/invoice.entity.ts` | Add payment fields |
| Company entity | `api/src/company/company.entity.ts` | Add provider config fields |
| Client entity | `api/src/clients/entities/client.entity.ts` | Add payeeId + autoSendDay |
| InvoicesService | `api/src/invoices/invoices.service.ts` | Use updateStatus() for state transitions |
| PdfService | `api/src/invoices/pdf.service.ts` | Generate PDF buffer for submission |
| CompanyService | `api/src/company/company.service.ts` | Fetch company + credentials |
| ZodValidationPipe | `api/src/common/pipes/` | Validate webhook payloads |

### Integration Points

| System | Integration Method |
|--------|-------------------|
| Invoice status | Reuse existing state machine (draft→sent, sent→paid) |
| PDF generation | PdfService.generate() returns buffer to attach |
| Company settings | CompanyService for provider config |
| Client data | Client.paymentProviderPayeeId for payee mapping |
| Tipalti API | HTTP calls via axios (or native fetch) |

---

## Components

### PaymentProvider Interface

- **Purpose**: Abstract contract for payment platform integrations
- **Location**: `packages/api/src/payments/providers/payment-provider.interface.ts`
- **Interface**:
  ```typescript
  interface SubmitInvoiceInput {
    invoiceNumber: string
    amount: number
    currency: string
    description: string
    issueDate: string
    dueDate: string
    payeeId: string      // client's ID in the payment platform
    pdfBuffer: Buffer     // generated PDF
  }

  interface SubmitInvoiceResult {
    providerRef: string   // external reference ID
    status: string        // provider-specific status
  }

  interface PaymentProvider {
    submitInvoice(input: SubmitInvoiceInput): Promise<SubmitInvoiceResult>
    getInvoiceStatus(providerRef: string): Promise<{ status: string; raw: Record<string, unknown> }>
    cancelInvoice(providerRef: string): Promise<void>
    validateConnection(): Promise<{ valid: boolean; message?: string }>
  }
  ```

### PaymentProviderFactory

- **Purpose**: Instantiate the correct provider based on company config
- **Location**: `packages/api/src/payments/providers/payment-provider.factory.ts`
- **Method**: `create(providerName: string, config: Record<string, string>): PaymentProvider`
- **Registry**: `Map<string, new (config) => PaymentProvider>` — extensible for future providers

### TipaltiProvider

- **Purpose**: Tipalti API adapter
- **Location**: `packages/api/src/payments/providers/tipalti.provider.ts`
- **Config**: `{ apiKey, payerEntity, baseUrl }` — decrypted from Company.paymentProviderConfig
- **Notes**:
  - Tipalti usa SOAP (v5/v6) como API principal; REST disponível para Procurement
  - A implementação inicial faz HTTP calls direto (sem SDK)
  - Sandbox URL vs Production URL controlado por `baseUrl` no config
  - Pode precisar de ajustes quando tivermos acesso ao sandbox real
- **Dependencies**: axios (ou fetch nativo do Node 22)

### PaymentsService

- **Purpose**: Business logic — orquestra envio, status, webhooks, cron
- **Location**: `packages/api/src/payments/payments.service.ts`
- **Methods**:
  - `submitInvoice(userId, invoiceId)` — busca invoice+company+client, gera PDF, chama provider
  - `checkStatus(userId, invoiceId)` — chama provider.getInvoiceStatus() com providerRef
  - `handleWebhook(providerName, payload, signature)` — valida assinatura, mapeia status, atualiza invoice
  - `testConnection(userId)` — busca company config, chama provider.validateConnection()
  - `processAutoSend()` — cron: busca invoices draft com autoSendDay = hoje, submete cada um
- **Dependencies**: InvoicesService, PdfService, CompanyService, PaymentProviderFactory, DataSource

### PaymentsController

- **Purpose**: HTTP endpoints para envio manual e status
- **Location**: `packages/api/src/payments/payments.controller.ts`
- **Endpoints**:
  - `POST /payments/send/:invoiceId` → submit invoice (auth required)
  - `GET /payments/status/:invoiceId` → check provider status (auth required)
  - `POST /payments/test-connection` → validate credentials (auth required)
- **Dependencies**: PaymentsService, `@CurrentUser()`

### WebhookController

- **Purpose**: Receive status updates from payment provider
- **Location**: `packages/api/src/payments/webhook.controller.ts`
- **Endpoints**:
  - `POST /webhooks/tipalti` → process Tipalti webhook (public — validates via signature)
- **Security**: `@Public()` decorator (no JWT) + signature validation in service
- **Dependencies**: PaymentsService

### CronService (Auto-Send)

- **Purpose**: Daily cron para envio automático de invoices
- **Location**: `packages/api/src/payments/payments-cron.service.ts`
- **Schedule**: Daily at 08:00 UTC (configurable)
- **Logic**:
  1. Query clients com `autoSendDay = dayOfMonth(today)` e `status = active`
  2. Para cada client, query invoices em `draft` com `issueDate <= today`
  3. Chama `PaymentsService.submitInvoice()` para cada
  4. Loga resultado (sucesso/falha) — sem retry automático no v1
- **Dependencies**: NestJS `@Cron()` decorator (via `@nestjs/schedule`)

---

## Data Models

### Entity Changes

**Invoice entity** — novos campos:

```typescript
@Column({ type: 'varchar', length: 255, nullable: true, comment: 'External reference ID from payment provider' })
paymentProviderRef: string | null

@Column({ type: 'varchar', length: 50, nullable: true, comment: 'Raw status from payment provider' })
paymentProviderStatus: string | null
```

**Company entity** — novos campos:

```typescript
@Column({ type: 'varchar', length: 20, nullable: true, comment: 'Payment provider name (e.g., tipalti)' })
paymentProvider: string | null

@Column({ type: 'text', nullable: true, comment: 'Encrypted JSON with provider credentials' })
paymentProviderConfig: string | null  // encrypted at rest
```

**Client entity** — novos campos:

```typescript
@Column({ type: 'varchar', length: 255, nullable: true, comment: 'Client ID in the payment platform (e.g., Tipalti payee ID)' })
paymentProviderPayeeId: string | null

@Column({ type: 'smallint', nullable: true, comment: 'Day of month (1-28) for automatic invoice submission' })
autoSendDay: number | null
```

### Shared Types (updates)

```typescript
// packages/shared/src/types/invoices.ts — add to InvoiceDetail
paymentProviderRef: string | null
paymentProviderStatus: string | null

// packages/shared/src/types/company.ts — add to CompanyResponse
paymentProvider: string | null
hasPaymentProvider: boolean  // derived — true if config exists (don't expose raw config)

// packages/shared/src/types/clients.ts — add to ClientDetail
paymentProviderPayeeId: string | null
autoSendDay: number | null
```

### Shared Schemas (updates)

```typescript
// packages/shared/src/schemas/clients.ts — add to createClientSchema
paymentProviderPayeeId: z.string().max(255).nullable().optional()
autoSendDay: z.number().int().min(1).max(28).nullable().optional()

// packages/shared/src/schemas/company.ts — new schema for payment config
const paymentProviderConfigSchema = z.object({
  paymentProvider: z.enum(['tipalti']).nullable(),
  apiKey: z.string().min(1),
  payerEntity: z.string().min(1),
  sandboxMode: z.boolean().default(true),
})
```

---

## Encryption Strategy

Provider credentials (`paymentProviderConfig`) armazenadas encrypted:

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key**: Environment variable `PAYMENT_ENCRYPTION_KEY` (32 bytes, base64)
- **Format stored**: `iv:authTag:ciphertext` (base64 encoded)
- **Implementation**: Utility functions `encrypt(plaintext, key)` / `decrypt(ciphertext, key)` em `packages/api/src/common/utils/encryption.ts`
- **When**: Encrypt on save (CompanyService.updatePaymentConfig), decrypt on read (PaymentProviderFactory.create)

---

## Webhook Flow

```
Tipalti → POST /webhooks/tipalti
         │
         ├─ Validate signature (HMAC-SHA256 of body with webhook secret)
         ├─ Parse payload → extract invoiceRef + status
         ├─ Find invoice by paymentProviderRef
         ├─ Map Tipalti status → internal status (paid, etc.)
         ├─ Update invoice via InvoicesService.updateStatus()
         └─ Return 200 OK (idempotent — re-processing same event is safe)
```

**Idempotency**: Se invoice já está no status target, o webhook é no-op (200 OK).

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
|----------------|----------|-------------|
| Provider API unreachable | Throw, return 502 | Toast "Payment provider unavailable" |
| Invalid credentials (test) | Return `{ valid: false, message }` | Show message in Settings |
| Client has no payeeId | Button disabled + tooltip | "Configure payment ID for this client" |
| Company has no provider | Button disabled + link | "Configure payment provider in Settings" |
| Webhook invalid signature | Return 401 | None (attacker rejected) |
| Webhook unknown invoice ref | Log warning, return 200 | None (no crash, idempotent) |
| Cron: single invoice fails | Log error, continue others | Admin log |
| Invoice already sent | Prevent re-submit (guard) | Toast "Invoice already sent" |

---

## Tech Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Adapter pattern | Interface + Factory | Extensible para futuros providers (Wise, Deel) |
| Credential storage | Encrypted JSON in Company | Simples, sem infra extra (vault) para v1 |
| Encryption | AES-256-GCM | Standard authenticated encryption, Node.js native crypto |
| Webhook auth | HMAC-SHA256 signature | Industry standard, Tipalti supports it |
| Cron | @nestjs/schedule | Already in NestJS ecosystem, simple daily job |
| Auto-send timing | Day of month (1-28) | Avoids 29-31 edge cases; simple for contractors |
| HTTP client for Tipalti | axios | Already in project dependencies |
| No retry queue (v1) | Log failures, manual retry | MVP simplicity — add Bull/BullMQ in v2 if needed |

---

## Security Considerations

- **Encrypted credentials at rest** — never expose raw API keys in responses
- **Webhook endpoint is @Public()** — no JWT, validated by HMAC signature only
- **Rate limiting on webhook** — use existing ThrottlerGuard (may need exemption tuning)
- **CompanyResponse never returns paymentProviderConfig** — only `hasPaymentProvider: boolean`
- **Encryption key rotation**: not in v1, but design supports it (prepend key version to ciphertext)
