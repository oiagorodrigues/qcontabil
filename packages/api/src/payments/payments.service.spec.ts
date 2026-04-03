import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BadRequestException, UnauthorizedException } from '@nestjs/common'
import type { Repository, ObjectLiteral } from 'typeorm'
import { createHmac } from 'node:crypto'
import { PaymentsService } from './payments.service'
import type { Invoice } from '../invoices/entities/invoice.entity'
import type { Company } from '../company/company.entity'
import type { Client } from '../clients/entities/client.entity'
import type { InvoicesService } from '../invoices/invoices.service'
import type { PdfService } from '../invoices/pdf.service'
import type { PaymentProviderFactory } from './providers/payment-provider.factory'
import type { ConfigService } from '@nestjs/config'
import { encrypt } from '../common/utils/encryption'

const ENCRYPTION_KEY = Buffer.alloc(32, 'a').toString('base64')
const WEBHOOK_SECRET = 'webhook-secret-test'

function createMockRepo<T extends ObjectLiteral>() {
  return {
    findOne: vi.fn(),
    findOneBy: vi.fn(),
    find: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
  } as unknown as Repository<T> & {
    findOne: ReturnType<typeof vi.fn>
    findOneBy: ReturnType<typeof vi.fn>
    find: ReturnType<typeof vi.fn>
    save: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
}

function makeEncryptedConfig(overrides: Record<string, unknown> = {}) {
  const config = { apiKey: 'api-key-123', payerEntity: 'acme', sandboxMode: true, ...overrides }
  return encrypt(JSON.stringify(config), ENCRYPTION_KEY)
}

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 'company-1',
    userId: 'user-1',
    paymentProvider: 'tipalti',
    paymentProviderConfig: makeEncryptedConfig(),
    ...overrides,
  } as unknown as Company
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-1',
    invoiceNumber: 'INV-0001',
    status: 'draft',
    userId: 'user-1',
    clientId: 'client-1',
    total: 1000,
    currency: 'USD',
    description: 'Dev services',
    issueDate: '2026-01-15',
    dueDate: '2026-02-15',
    paymentProviderRef: null,
    paymentProviderStatus: null,
    client: {
      id: 'client-1',
      paymentProviderPayeeId: 'payee-abc',
    } as unknown as Client,
    lineItems: [],
    extraItems: [],
    ...overrides,
  } as unknown as Invoice
}

function buildService({
  invoiceRepo,
  companyRepo,
  clientRepo,
  invoicesService,
  pdfService,
  factory,
  config,
}: {
  invoiceRepo?: ReturnType<typeof createMockRepo<Invoice>>
  companyRepo?: ReturnType<typeof createMockRepo<Company>>
  clientRepo?: ReturnType<typeof createMockRepo<Client>>
  invoicesService?: Partial<InvoicesService>
  pdfService?: Partial<PdfService>
  factory?: Partial<PaymentProviderFactory>
  config?: Partial<ConfigService>
}) {
  const ir = invoiceRepo ?? createMockRepo<Invoice>()
  const cr = companyRepo ?? createMockRepo<Company>()
  const clr = clientRepo ?? createMockRepo<Client>()

  const defaultProvider = {
    submitInvoice: vi.fn().mockResolvedValue({ providerRef: 'tipalti-ref-1', status: 'pending' }),
    getInvoiceStatus: vi.fn().mockResolvedValue({ status: 'paid' }),
    cancelInvoice: vi.fn().mockResolvedValue(undefined),
    validateConnection: vi.fn().mockResolvedValue({ valid: true }),
  }

  const svc = new PaymentsService(
    ir as unknown as Repository<Invoice>,
    cr as unknown as Repository<Company>,
    clr as unknown as Repository<Client>,
    (invoicesService ?? {
      findOne: vi.fn().mockResolvedValue({ id: 'inv-1', template: 'classic' }),
      updateStatus: vi.fn().mockResolvedValue(undefined),
    }) as unknown as InvoicesService,
    (pdfService ?? {
      generate: vi.fn().mockResolvedValue(Buffer.from('pdf')),
    }) as unknown as PdfService,
    (factory ?? {
      create: vi.fn().mockReturnValue(defaultProvider),
    }) as unknown as PaymentProviderFactory,
    (config ?? {
      get: (key: string) => {
        if (key === 'PAYMENT_ENCRYPTION_KEY') return ENCRYPTION_KEY
        if (key === 'TIPALTI_WEBHOOK_SECRET') return WEBHOOK_SECRET
        return undefined
      },
    }) as unknown as ConfigService,
  )

  return { svc, ir, cr, clr, defaultProvider }
}

// ─── submitInvoice ────────────────────────────────────────────────────────────

describe('PaymentsService.submitInvoice', () => {
  it('happy path: submits invoice and updates status', async () => {
    const invoice = makeInvoice()
    const company = makeCompany()

    const { svc, ir, cr } = buildService({})
    ir.findOne.mockResolvedValue(invoice)
    cr.findOneBy.mockResolvedValue(company)
    ir.update.mockResolvedValue(undefined)

    await expect(svc.submitInvoice('user-1', 'inv-1')).resolves.toBeUndefined()
    expect(ir.update).toHaveBeenCalledWith(
      'inv-1',
      expect.objectContaining({ paymentProviderRef: 'tipalti-ref-1', status: 'sent' }),
    )
  })

  it('throws NotFoundException when invoice not found', async () => {
    const { svc, ir } = buildService({})
    ir.findOne.mockResolvedValue(null)

    await expect(svc.submitInvoice('user-1', 'missing-id')).rejects.toThrow(Error)
  })

  it('throws BadRequestException when client has no payeeId', async () => {
    const invoice = makeInvoice({
      client: { id: 'client-1', paymentProviderPayeeId: null } as unknown as Client,
    })
    const company = makeCompany()

    const { svc, ir, cr } = buildService({})
    ir.findOne.mockResolvedValue(invoice)
    cr.findOneBy.mockResolvedValue(company)

    await expect(svc.submitInvoice('user-1', 'inv-1')).rejects.toThrow(BadRequestException)
  })

  it('throws BadRequestException when company has no payment provider', async () => {
    const invoice = makeInvoice()
    const company = makeCompany({ paymentProvider: null, paymentProviderConfig: null })

    const { svc, ir, cr } = buildService({})
    ir.findOne.mockResolvedValue(invoice)
    cr.findOneBy.mockResolvedValue(company)

    await expect(svc.submitInvoice('user-1', 'inv-1')).rejects.toThrow(BadRequestException)
  })

  it('throws BadRequestException when invoice already submitted', async () => {
    const invoice = makeInvoice({ paymentProviderRef: 'existing-ref' })
    const company = makeCompany()

    const { svc, ir, cr } = buildService({})
    ir.findOne.mockResolvedValue(invoice)
    cr.findOneBy.mockResolvedValue(company)

    await expect(svc.submitInvoice('user-1', 'inv-1')).rejects.toThrow(BadRequestException)
  })
})

// ─── handleWebhook ────────────────────────────────────────────────────────────

describe('PaymentsService.handleWebhook', () => {
  function makeSignature(body: Buffer) {
    return createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')
  }

  it('processes valid webhook and updates invoice status', async () => {
    const invoice = makeInvoice({ paymentProviderRef: 'tipalti-ref-1', status: 'sent' })
    const payload = JSON.stringify({ invoiceRef: 'tipalti-ref-1', status: 'paid' })
    const rawBody = Buffer.from(payload)
    const signature = makeSignature(rawBody)

    const updateStatus = vi.fn().mockResolvedValue(undefined)
    const { svc, ir } = buildService({ invoicesService: { updateStatus, findOne: vi.fn() } as unknown as Partial<InvoicesService> })
    ir.findOneBy.mockResolvedValue(invoice)
    ir.update.mockResolvedValue(undefined)

    await expect(svc.handleWebhook('tipalti', rawBody, signature)).resolves.toBeUndefined()
    expect(ir.update).toHaveBeenCalledWith(invoice.id, { paymentProviderStatus: 'paid' })
    expect(updateStatus).toHaveBeenCalledWith('user-1', 'inv-1', { status: 'paid' })
  })

  it('rejects invalid webhook signature', async () => {
    const rawBody = Buffer.from('{"invoiceRef":"ref","status":"paid"}')

    const { svc } = buildService({})

    await expect(svc.handleWebhook('tipalti', rawBody, 'bad-signature')).rejects.toThrow(
      UnauthorizedException,
    )
  })

  it('is idempotent: skips updateStatus when invoice already in target status', async () => {
    const invoice = makeInvoice({ paymentProviderRef: 'tipalti-ref-1', status: 'paid' })
    const payload = JSON.stringify({ invoiceRef: 'tipalti-ref-1', status: 'paid' })
    const rawBody = Buffer.from(payload)
    const signature = makeSignature(rawBody)

    const updateStatus = vi.fn()
    const { svc, ir } = buildService({ invoicesService: { updateStatus, findOne: vi.fn() } as unknown as Partial<InvoicesService> })
    ir.findOneBy.mockResolvedValue(invoice)
    ir.update.mockResolvedValue(undefined)

    await svc.handleWebhook('tipalti', rawBody, signature)
    expect(updateStatus).not.toHaveBeenCalled()
  })
})
