import type { InvoiceStatus, InvoiceTemplateType } from '../schemas/invoices'
import type { Currency } from '../schemas/clients'

export interface InvoiceLineItemResponse {
  id: string
  description: string
  quantity: number
  unitPrice: number
  amount: number
  sortOrder: number
}

export interface InvoiceExtraResponse {
  id: string
  description: string
  amount: number
  sortOrder: number
}

export interface InvoiceSummary {
  id: string
  invoiceNumber: string
  status: InvoiceStatus
  issueDate: string
  dueDate: string
  currency: Currency
  total: number
  clientFantasyName: string
  clientId: string
  createdAt: string
}

export interface InvoiceDetail {
  id: string
  invoiceNumber: string
  status: InvoiceStatus
  issueDate: string
  dueDate: string
  sentAt: string | null
  paidAt: string | null
  currency: Currency
  description: string
  notes: string | null
  paymentInstructions: string | null
  subtotal: number
  extrasTotal: number
  total: number
  clientId: string
  client: {
    fantasyName: string
    company: string
    email: string
    address: string | null
    country: string
    countryCode: string
    paymentProviderPayeeId: string | null
  }
  lineItems: InvoiceLineItemResponse[]
  extraItems: InvoiceExtraResponse[]
  template: InvoiceTemplateType
  paymentProviderRef: string | null
  paymentProviderStatus: string | null
  createdAt: string
  updatedAt: string
}

export interface InvoiceClientSummary {
  id: string
  invoiceNumber: string
  status: InvoiceStatus
  issueDate: string
  total: number
  currency: Currency
}
