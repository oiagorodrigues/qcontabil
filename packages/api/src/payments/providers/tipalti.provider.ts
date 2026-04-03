import type {
  PaymentProvider,
  SubmitInvoiceInput,
  SubmitInvoiceResult,
  InvoiceStatusResult,
  ConnectionValidationResult,
} from './payment-provider.interface'

interface TipaltiConfig {
  apiKey: string
  payerEntity: string
  baseUrl: string
}

/**
 * Tipalti payment provider adapter.
 *
 * NOTE: This implementation uses placeholder logic for API calls.
 * Tipalti's primary API is SOAP-based (v5/v6). Once sandbox credentials
 * are obtained, the HTTP calls below must be updated to match the real
 * API contracts. See .specs/features/payment-integration/spec.md —
 * "Configuração Manual Necessária" for required setup steps.
 */
export class TipaltiProvider implements PaymentProvider {
  private readonly config: TipaltiConfig

  constructor(config: Record<string, string>) {
    if (!config.apiKey || !config.payerEntity || !config.baseUrl) {
      throw new Error('TipaltiProvider requires apiKey, payerEntity, and baseUrl')
    }
    this.config = {
      apiKey: config.apiKey,
      payerEntity: config.payerEntity,
      baseUrl: config.baseUrl,
    }
  }

  async submitInvoice(input: SubmitInvoiceInput): Promise<SubmitInvoiceResult> {
    // TODO: Replace with real Tipalti API call once sandbox access is obtained.
    // Tipalti uses SOAP for invoice submission (AP module).
    // Expected endpoint: POST {baseUrl}/api/v1/bills (or SOAP equivalent)
    // Payload will include: payeeId, amount, currency, pdfBuffer (base64 or multipart)
    const response = await this.post('/api/v1/bills', {
      payerId: this.config.payerEntity,
      payeeId: input.payeeId,
      invoiceNumber: input.invoiceNumber,
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      attachment: input.pdfBuffer.toString('base64'),
    })

    return {
      providerRef: String(response.billId ?? response.id ?? ''),
      status: String(response.status ?? 'pending'),
    }
  }

  async getInvoiceStatus(providerRef: string): Promise<InvoiceStatusResult> {
    // TODO: Replace with real Tipalti status check endpoint.
    const response = await this.get(`/api/v1/bills/${providerRef}`)

    return {
      status: String(response.status ?? 'unknown'),
      raw: response as Record<string, unknown>,
    }
  }

  async cancelInvoice(providerRef: string): Promise<void> {
    // TODO: Replace with real Tipalti cancel endpoint.
    await this.post(`/api/v1/bills/${providerRef}/cancel`, {})
  }

  async validateConnection(): Promise<ConnectionValidationResult> {
    // TODO: Replace with real Tipalti health check / auth validation endpoint.
    try {
      await this.get('/api/v1/payers/me')
      return { valid: true }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed'
      return { valid: false, message }
    }
  }

  private async get(path: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.config.baseUrl}${path}`, {
      headers: this.authHeaders(),
    })
    if (!res.ok) {
      throw new Error(`Tipalti API error: ${res.status} ${res.statusText}`)
    }
    return res.json() as Promise<Record<string, unknown>>
  }

  private async post(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.config.baseUrl}${path}`, {
      method: 'POST',
      headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      throw new Error(`Tipalti API error: ${res.status} ${res.statusText}`)
    }
    return res.json() as Promise<Record<string, unknown>>
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
    }
  }
}
