# Payment Integration — Tasks

**Design:** `design.md`
**Status:** READY

---

## Execution Plan

```
Phase 1 (Foundation):
  T1 (PaymentProvider interface + factory)
  T2 (shared types + schemas updates)

Phase 2 (DB + Encryption — parallel):
  T1, T2 complete, then:
    ├── T3 (encryption utils)                [P]
    ├── T4 (entity updates + migration)      [P]
    └── T5 (shared schemas update)           [P]

Phase 3 (Provider + Service):
  T3, T4 complete, then:
    T6 (TipaltiProvider adapter)
    T7 (PaymentsService)

Phase 4 (Endpoints — parallel):
  T7 complete, then:
    ├── T8 (PaymentsController)        [P]
    ├── T9 (WebhookController)         [P]
    └── T10 (PaymentsCronService)      [P]

Phase 5 (Module + Wiring):
  T8, T9, T10 complete, then:
    T11 (PaymentsModule + app.module)

Phase 6 (Frontend — parallel):
  T11 complete, then:
    ├── T12 (client form: payeeId + autoSendDay)  [P]
    ├── T13 (company settings: provider config)    [P]
    ├── T14 (invoice detail: send button + badge)  [P]

Phase 7 (Tests):
  T15 (backend tests)
```

---

## Task Breakdown

### T1 — Backend: PaymentProvider interface + factory

**What:** Criar interface abstrata, types de input/output, e factory com registry
**Where:**
- `packages/api/src/payments/providers/payment-provider.interface.ts` (new)
- `packages/api/src/payments/providers/payment-provider.factory.ts` (new)
**Depends on:** None
**Requirement:** PAY-01, PAY-04

**Steps:**
1. Criar `SubmitInvoiceInput`, `SubmitInvoiceResult`, `PaymentProvider` interface
2. Criar `PaymentProviderFactory` com `Map<string, new (config) => PaymentProvider>` e método `create(name, config)`
3. Exportar tudo

**Done when:**
- [x] TypeScript compila sem erros
- [x] Interface tem 4 métodos: submitInvoice, getInvoiceStatus, cancelInvoice, validateConnection

---

### T2 — Shared: types + schemas updates para payment fields

**What:** Adicionar campos de payment nos types e schemas existentes
**Where:**
- `packages/shared/src/types/invoices.ts` (update)
- `packages/shared/src/types/company.ts` (update)
- `packages/shared/src/types/clients.ts` (update)
**Depends on:** None
**Requirement:** PAY-05, PAY-08, PAY-21, PAY-22

**Steps:**
1. `InvoiceDetail`: adicionar `paymentProviderRef: string | null`, `paymentProviderStatus: string | null`
2. `CompanyResponse`: adicionar `paymentProvider: string | null`, `hasPaymentProvider: boolean`
3. `ClientDetail`: adicionar `paymentProviderPayeeId: string | null`, `autoSendDay: number | null`

**Done when:**
- [x] `pnpm --filter shared build` passa sem erros
- [x] Types exportados corretamente

---

### T3 — Backend: encryption utils

**What:** Criar funções encrypt/decrypt para credentials do provider
**Where:** `packages/api/src/common/utils/encryption.ts` (new)
**Depends on:** T1 (conceptually — needs the context of what will be encrypted)
**Requirement:** PAY-05

**Steps:**
1. Implementar `encrypt(plaintext: string, key: string): string` — AES-256-GCM, retorna `iv:authTag:ciphertext` base64
2. Implementar `decrypt(encrypted: string, key: string): string` — parse iv:authTag:ciphertext, decrypt
3. Key vem de `PAYMENT_ENCRYPTION_KEY` env var (32 bytes base64)
4. Validar que key tem tamanho correto

**Done when:**
- [x] Roundtrip: encrypt → decrypt retorna texto original
- [x] Chave inválida lança erro
- [x] Ciphertext adulterado lança erro (GCM auth tag)

---

### T4 — DB: entity updates + migration

**What:** Adicionar campos de payment nas entities Invoice, Company, Client
**Where:**
- `packages/api/src/invoices/entities/invoice.entity.ts` (update)
- `packages/api/src/company/company.entity.ts` (update)
- `packages/api/src/clients/entities/client.entity.ts` (update)
**Depends on:** T1 (para saber os types corretos)
**Requirement:** PAY-05, PAY-08, PAY-16, PAY-21, PAY-22

**Steps:**
1. Invoice: adicionar `paymentProviderRef` (varchar 255, nullable) e `paymentProviderStatus` (varchar 50, nullable)
2. Company: adicionar `paymentProvider` (varchar 20, nullable) e `paymentProviderConfig` (text, nullable)
3. Client: adicionar `paymentProviderPayeeId` (varchar 255, nullable) e `autoSendDay` (smallint, nullable)
4. Todos com `comment` nos `@Column()`

**Done when:**
- [x] Entities compilam sem erros
- [x] DB sync cria colunas novas (verificar com query)

---

### T5 — Shared: schemas update para client + company forms

**What:** Atualizar Zod schemas para incluir novos campos nos forms de client e company
**Where:**
- `packages/shared/src/schemas/clients.ts` (update)
- `packages/shared/src/schemas/company.ts` (new schema para payment config)
**Depends on:** T2 (types definem os campos)
**Requirement:** PAY-06, PAY-09, PAY-17

**Steps:**
1. `clients.ts`: adicionar `paymentProviderPayeeId` (string, max 255, nullable, optional) e `autoSendDay` (number, int, 1-28, nullable, optional) ao schema
2. `company.ts`: criar `paymentProviderConfigSchema` com: `paymentProvider` (enum tipalti), `apiKey`, `payerEntity`, `sandboxMode`
3. Exportar novo schema

**Done when:**
- [x] `pnpm --filter shared build` passa sem erros
- [x] Validation funciona (parse com dados válidos e inválidos)

---

### T6 — Backend: TipaltiProvider adapter

**What:** Implementar adapter do Tipalti que implementa PaymentProvider interface
**Where:** `packages/api/src/payments/providers/tipalti.provider.ts` (new)
**Depends on:** T1 (interface), T3 (decrypted config)
**Reuses:** PaymentProvider interface
**Requirement:** PAY-02, PAY-03

**Steps:**
1. Criar `TipaltiProvider` implementando `PaymentProvider`
2. Constructor recebe `{ apiKey, payerEntity, baseUrl }`
3. `submitInvoice()`: POST para Tipalti API com dados do invoice + PDF (multipart ou base64)
4. `getInvoiceStatus()`: GET status pelo providerRef
5. `cancelInvoice()`: POST cancel pelo providerRef
6. `validateConnection()`: GET simples para validar API key (health check endpoint)
7. Registrar no factory registry
8. **Nota**: implementação usa stubs/placeholders para endpoints exatos — será ajustado quando tivermos sandbox access

**Done when:**
- [x] Implementa todos os 4 métodos da interface
- [x] Registrado no factory (via module em T11)
- [x] TypeScript compila sem erros

---

### T7 — Backend: PaymentsService

**What:** Service com business logic de envio, status, webhook handling
**Where:** `packages/api/src/payments/payments.service.ts` (new)
**Depends on:** T4 (entities com novos campos), T6 (provider disponível)
**Reuses:** InvoicesService.updateStatus(), PdfService.generate(), CompanyService
**Requirement:** PAY-10, PAY-11, PAY-12, PAY-23, PAY-24, PAY-25

**Steps:**
1. Injetar: DataSource, InvoicesService, PdfService, CompanyService, PaymentProviderFactory
2. `submitInvoice(userId, invoiceId)`:
   - Busca invoice, company, client
   - Valida: invoice em draft/sent, client tem payeeId, company tem provider
   - Gera PDF via PdfService
   - Chama provider.submitInvoice()
   - Atualiza invoice: status→sent, paymentProviderRef, paymentProviderStatus, sentAt
3. `checkStatus(userId, invoiceId)`:
   - Busca invoice, company
   - Chama provider.getInvoiceStatus(providerRef)
   - Atualiza paymentProviderStatus
4. `handleWebhook(providerName, payload, signature)`:
   - Valida HMAC signature
   - Extrai invoiceRef + status do payload
   - Busca invoice por paymentProviderRef
   - Mapeia status → updateStatus (sent→paid, etc.)
   - Idempotent: se já no status target, no-op
5. `testConnection(userId)`:
   - Busca company, decrypt config, instancia provider, chama validateConnection()

**Done when:**
- [x] Todos os métodos implementados
- [x] Validações corretas (missing payeeId, missing provider, etc.)
- [x] TypeScript compila sem erros

---

### T8 — Backend: PaymentsController

**What:** Endpoints para envio manual e status check
**Where:** `packages/api/src/payments/payments.controller.ts` (new)
**Depends on:** T7
**Requirement:** PAY-10, PAY-07

**Steps:**
1. `POST /payments/send/:invoiceId` → service.submitInvoice() (auth required)
2. `GET /payments/status/:invoiceId` → service.checkStatus() (auth required)
3. `POST /payments/test-connection` → service.testConnection() (auth required)
4. ParseUUIDPipe para invoiceId

**Done when:**
- [x] 3 endpoints definidos com decorators corretos
- [x] TypeScript compila sem erros

---

### T9 — Backend: WebhookController

**What:** Endpoint público para receber webhooks do Tipalti
**Where:** `packages/api/src/payments/webhook.controller.ts` (new)
**Depends on:** T7
**Requirement:** PAY-23, PAY-24, PAY-25

**Steps:**
1. `POST /webhooks/tipalti` com `@Public()` decorator (sem JWT)
2. Recebe raw body + headers (signature)
3. Chama service.handleWebhook('tipalti', body, signature)
4. Retorna 200 OK em todos os casos (sucesso ou skip)

**Done when:**
- [x] Endpoint marcado como @Public()
- [x] Retorna 200 sem exigir auth
- [x] TypeScript compila sem erros

---

### T10 — Backend: PaymentsCronService

**What:** Cron job diário para envio automático de invoices
**Where:** `packages/api/src/payments/payments-cron.service.ts` (new)
**Depends on:** T7
**Requirement:** PAY-16, PAY-18, PAY-19, PAY-20

**Steps:**
1. Injetar PaymentsService, DataSource
2. `@Cron('0 8 * * *')` — daily at 08:00 UTC
3. Query clients com `autoSendDay = dayOfMonth(today)` e `status = active`
4. Para cada client: query invoices em `draft` com `issueDate <= today`
5. Chama `PaymentsService.submitInvoice()` para cada
6. Logger: resultado por invoice (sucesso/falha)
7. Não interromper se um falhar — continuar com próximos

**Done when:**
- [x] Cron registrado com schedule correto
- [x] Loga resultados
- [x] Falha individual não para o batch

---

### T11 — Backend: PaymentsModule + wiring

**What:** Criar module NestJS e registrar em app.module
**Where:**
- `packages/api/src/payments/payments.module.ts` (new)
- `packages/api/src/app.module.ts` (update)
**Depends on:** T8, T9, T10
**Requirement:** PAY-01

**Steps:**
1. Criar `PaymentsModule` importando: TypeOrmModule.forFeature([Invoice, Client, Company]), InvoicesModule, CompanyModule, ScheduleModule
2. Providers: PaymentsService, PaymentProviderFactory, TipaltiProvider, PaymentsCronService
3. Controllers: PaymentsController, WebhookController
4. Adicionar PaymentsModule e ScheduleModule.forRoot() em app.module.ts

**Done when:**
- [x] `pnpm --filter api build` compila sem erros
- [x] App inicia sem erros de DI

---

### T12 — Frontend: client form — payeeId + autoSendDay

**What:** Adicionar campos de payment no formulário de client (create + edit)
**Where:** `packages/web/src/features/clients/components/ClientForm.tsx` (update)
**Depends on:** T5 (schemas atualizados)
**Reuses:** Existing form pattern (TanStack Form)
**Requirement:** PAY-09, PAY-17

**Steps:**
1. Adicionar seção "Payment Settings" no form
2. Campo `paymentProviderPayeeId`: Input text com label "Payment Platform ID (e.g., Tipalti Payee ID)"
3. Campo `autoSendDay`: Select com opções 1-28 + "Disabled" (null)
4. Campos opcionais — não bloqueia criação de client
5. Garantir que valores são enviados no payload

**Done when:**
- [x] Campos aparecem no form
- [x] Create e edit enviam os novos campos
- [x] Campos são opcionais

---

### T13 — Frontend: company settings — provider config

**What:** Tela de configuração do payment provider em Settings
**Where:**
- `packages/web/src/features/company/components/PaymentProviderSettings.tsx` (new)
- `packages/web/src/features/company/pages/CompanyPage.tsx` (update — adicionar seção)
- `packages/web/src/features/company/api/company.api.ts` (update — novo endpoint)
**Depends on:** T5 (schema), T8 (test-connection endpoint)
**Reuses:** Card, Input, Button, Select components
**Requirement:** PAY-05, PAY-06, PAY-07

**Steps:**
1. Criar `PaymentProviderSettings` com form: provider select (tipalti), API Key (password input), Payer Entity, Sandbox Mode (toggle)
2. Botão "Save" → POST/PUT para company payment config
3. Botão "Test Connection" → POST /payments/test-connection → mostrar resultado
4. Se já configurado, mostrar status "Connected" com opção de reconfigure
5. Adicionar seção no CompanyPage

**Done when:**
- [x] Form renderiza e submete
- [x] Test Connection funciona (mostra sucesso/falha)
- [x] API Key mascarado no form (type=password)

---

### T14 — Frontend: invoice detail — send button + status badge

**What:** Botão "Send via Payment Platform" no invoice detail e badge de provider status
**Where:** `packages/web/src/features/invoices/pages/InvoiceDetailPage.tsx` (update)
**Depends on:** T2 (types com novos campos), T8 (send endpoint)
**Reuses:** Button, Badge, Tooltip components
**Requirement:** PAY-10, PAY-11, PAY-13, PAY-14, PAY-26

**Steps:**
1. Botão "Send via Payment Platform":
   - Visível quando invoice está em `draft` ou `sent` (sem providerRef)
   - Disabled + tooltip se client não tem payeeId
   - Disabled + link "Configure in Settings" se company não tem provider
   - onClick: POST /payments/send/:id → refetch invoice
2. Badge `paymentProviderStatus` ao lado do status principal (quando presente)
3. Loading state no botão durante envio

**Done when:**
- [ ] Botão aparece e funciona
- [ ] Disabled states com tooltips corretos
- [ ] Badge de provider status visível quando há providerRef

---

### T15 — Testes

**What:** Unit tests e integration tests do módulo de payments
**Where:**
- `packages/api/src/payments/payments.service.spec.ts` (new)
- `packages/api/src/common/utils/encryption.spec.ts` (new)
- `packages/api/test/payments/` (integration tests)
**Depends on:** T11
**Requirement:** PAY-01, PAY-25

**Steps:**
1. Unit test: encrypt/decrypt roundtrip + tampered ciphertext rejects
2. Unit test: PaymentsService.submitInvoice() — happy path (mock provider)
3. Unit test: PaymentsService.submitInvoice() — missing payeeId throws
4. Unit test: PaymentsService.submitInvoice() — missing provider config throws
5. Unit test: PaymentsService.handleWebhook() — valid signature processes
6. Unit test: PaymentsService.handleWebhook() — invalid signature rejects
7. Unit test: PaymentsService.handleWebhook() — idempotent (already paid → no-op)
8. Integration test: POST /payments/send/:id retorna 200 (com mock provider)
9. Integration test: POST /webhooks/tipalti retorna 200 sem auth
10. Integration test: POST /payments/test-connection retorna resultado

**Done when:**
- [ ] `pnpm --filter api test:unit` passa
- [ ] `pnpm --filter api test:integration` passa

---

## Dependency Graph

```
T1 (interface + factory)     T2 (shared types)
├── T3 (encryption)    [P]   │
├── T4 (entities + DB) [P]   │
│   └─────────────┬──────────┘
│                 T5 (shared schemas)
├── T6 (TipaltiProvider)
│   └── T7 (PaymentsService)
│       ├── T8 (PaymentsController)    [P]
│       ├── T9 (WebhookController)     [P]
│       └── T10 (CronService)          [P]
│           └── T11 (Module + wiring)
│               ├── T12 (client form)  [P]
│               ├── T13 (settings UI)  [P]
│               └── T14 (invoice send) [P]
│                   └── T15 (tests)
```
