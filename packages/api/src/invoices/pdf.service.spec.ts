import { describe, it, expect } from 'vitest'
import { PdfService } from './pdf.service'
import { getTemplate } from './templates/template.registry'
import { InvoiceTemplate } from './templates/template.types'
import type { InvoiceDetail } from '@qcontabil/shared'
import type { CompanyResponse } from '@qcontabil/shared'

const NOW = '2026-01-15T10:00:00.000Z'

function makeInvoiceDetail(overrides: Partial<InvoiceDetail> = {}): InvoiceDetail {
  return {
    id: 'inv-1',
    invoiceNumber: 'INV-0001',
    status: 'draft',
    issueDate: '2026-01-15',
    dueDate: '2026-02-15',
    sentAt: null,
    paidAt: null,
    currency: 'USD',
    description: 'Development services',
    notes: null,
    paymentInstructions: null,
    subtotal: 8000,
    extrasTotal: 500,
    total: 8500,
    clientId: 'client-1',
    client: {
      fantasyName: 'Acme Corp',
      company: 'Acme Inc.',
      email: 'billing@acme.com',
      address: null,
      country: 'United States',
      countryCode: 'US',
    },
    lineItems: [
      {
        id: 'li-1',
        description: 'Development work',
        quantity: 160,
        unitPrice: 50,
        amount: 8000,
        sortOrder: 0,
      },
    ],
    extraItems: [
      {
        id: 'ex-1',
        description: 'Bonus',
        amount: 500,
        sortOrder: 0,
      },
    ],
    template: 'classic',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

const COMPANY: CompanyResponse = {
  id: 'company-1',
  legalName: 'My Company Ltda',
  cnpj: '12345678000100',
  taxRegime: 'MEI' as CompanyResponse['taxRegime'],
  email: 'me@company.com',
  phone: '11999999999',
  street: 'Rua A',
  streetNumber: '100',
  complement: null,
  zipCode: '01001000',
  city: 'Sao Paulo',
  state: 'SP' as CompanyResponse['state'],
  country: 'Brazil',
  bankBeneficiaryName: null,
  bankName: null,
  bankAccountType: null,
  bankAccountNumber: null,
  bankSwiftCode: null,
  invoicePrefix: 'INV',
  defaultTemplate: null,
  createdAt: NOW,
  updatedAt: NOW,
}

describe('PdfService', () => {
  const service = new PdfService()

  describe('generate()', () => {
    it('generates non-empty buffer with classic template', async () => {
      const invoice = makeInvoiceDetail({ template: 'classic' })
      const buffer = await service.generate(invoice, COMPANY)

      expect(Buffer.isBuffer(buffer)).toBe(true)
      expect(buffer.length).toBeGreaterThan(0)
    })

    it('generates non-empty buffer with modern template', async () => {
      const invoice = makeInvoiceDetail({ template: 'modern' })
      const buffer = await service.generate(invoice, COMPANY)

      expect(Buffer.isBuffer(buffer)).toBe(true)
      expect(buffer.length).toBeGreaterThan(0)
    })

    it('generates non-empty buffer with minimal template', async () => {
      const invoice = makeInvoiceDetail({ template: 'minimal' })
      const buffer = await service.generate(invoice, COMPANY)

      expect(Buffer.isBuffer(buffer)).toBe(true)
      expect(buffer.length).toBeGreaterThan(0)
    })

    it('generates buffer with null company', async () => {
      const invoice = makeInvoiceDetail({ template: 'classic' })
      const buffer = await service.generate(invoice, null)

      expect(Buffer.isBuffer(buffer)).toBe(true)
      expect(buffer.length).toBeGreaterThan(0)
    })
  })
})

describe('getTemplate()', () => {
  it('returns function for classic template', () => {
    const fn = getTemplate(InvoiceTemplate.CLASSIC)
    expect(typeof fn).toBe('function')
  })

  it('returns function for modern template', () => {
    const fn = getTemplate(InvoiceTemplate.MODERN)
    expect(typeof fn).toBe('function')
  })

  it('returns function for minimal template', () => {
    const fn = getTemplate(InvoiceTemplate.MINIMAL)
    expect(typeof fn).toBe('function')
  })

  it('throws descriptive error for unregistered template', () => {
    expect(() => getTemplate('invalid' as InvoiceTemplate)).toThrow('Template not registered: invalid')
  })
})
