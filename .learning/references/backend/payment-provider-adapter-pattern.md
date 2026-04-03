# Payment Provider Adapter Pattern with Factory Registry

## Context

Abstracting multiple payment providers (starting with Tipalti) behind a common interface so business logic doesn't depend on any specific provider.

## Structure

```
payments/providers/
  payment-provider.interface.ts  — interface + input/output types
  payment-provider.factory.ts    — injectable registry
  tipalti.provider.ts            — concrete adapter
```

## Interface

```typescript
export interface PaymentProvider {
  submitInvoice(input: SubmitInvoiceInput): Promise<SubmitInvoiceResult>
  getInvoiceStatus(providerRef: string): Promise<InvoiceStatusResult>
  cancelInvoice(providerRef: string): Promise<void>
  validateConnection(): Promise<ConnectionValidationResult>
}
```

## Factory Registry

```typescript
type ProviderConstructor = new (config: Record<string, unknown>) => PaymentProvider

@Injectable()
export class PaymentProviderFactory {
  private readonly registry = new Map<string, ProviderConstructor>()

  register(name: string, ctor: ProviderConstructor): void {
    this.registry.set(name, ctor)
  }

  create(name: string, config: Record<string, unknown>): PaymentProvider {
    const Ctor = this.registry.get(name)
    if (!Ctor) throw new Error(`Unknown payment provider: ${name}`)
    return new Ctor(config)
  }
}
```

## Module Wiring (register at startup)

```typescript
{
  provide: PaymentProviderFactory,
  useFactory: () => {
    const factory = new PaymentProviderFactory()
    factory.register('tipalti', TipaltiProvider)
    return factory
  },
}
```

## Why DataSource over Service for Encrypted Fields

`CompanyService.findByUser()` returns `CompanyResponse` — a DTO that omits the encrypted `paymentProviderConfig` field (by design). When `PaymentsService` needs to decrypt and use those credentials, it must inject `Repository<Company>` or `DataSource` directly to access the raw entity field.

This is intentional: the DTO layer strips sensitive fields, so bypassing it for internal service use is correct.

## Stub Provider Pattern

When real API endpoints aren't available yet (waiting for sandbox access), implement the interface with `fetch()` calls to placeholder URLs and `// TODO` comments:

```typescript
async submitInvoice(input: SubmitInvoiceInput): Promise<SubmitInvoiceResult> {
  // TODO: replace with real Tipalti Bills API endpoint when sandbox access is granted
  // POST https://api.sandbox.tipalti.com/v3/bills
  throw new Error('TipaltiProvider.submitInvoice: not yet connected to real endpoint')
}
```

This satisfies TypeScript, makes the missing integration explicit, and doesn't silently no-op.
