import type {
  CreateInvoiceInput,
  UpdateInvoiceInput,
  UpdateInvoiceStatusInput,
  InvoiceDetail,
  InvoiceSummary,
  InvoiceClientSummary,
  PaginatedResponse,
} from '@qcontabil/shared'
import { httpClient } from '@/lib/http-client'

interface ListInvoicesParams {
  search?: string
  status?: string
  clientId?: string
  sort?: string
  page?: number
  limit?: number
}

export const invoicesApi = {
  create(data: CreateInvoiceInput) {
    return httpClient.post<InvoiceDetail>('/invoices', data)
  },

  list(params: ListInvoicesParams = {}) {
    return httpClient.get<PaginatedResponse<InvoiceSummary>>('/invoices', { params })
  },

  get(id: string) {
    return httpClient.get<InvoiceDetail>(`/invoices/${id}`)
  },

  update(id: string, data: UpdateInvoiceInput) {
    return httpClient.put<InvoiceDetail>(`/invoices/${id}`, data)
  },

  updateStatus(id: string, data: UpdateInvoiceStatusInput) {
    return httpClient.patch<InvoiceDetail>(`/invoices/${id}/status`, data)
  },

  async downloadPdf(id: string, invoiceNumber: string) {
    const response = await httpClient.get<Blob>(`/invoices/${id}/pdf`, {
      responseType: 'blob',
    })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = `invoice-${invoiceNumber}.pdf`
    link.click()
    URL.revokeObjectURL(url)
  },

  duplicate(id: string) {
    return httpClient.post<InvoiceDetail>(`/invoices/${id}/duplicate`)
  },

  listByClient(clientId: string) {
    return httpClient.get<InvoiceClientSummary[]>(`/invoices/by-client/${clientId}`)
  },

  submitToPaymentProvider(id: string) {
    return httpClient.post<{ message: string }>(`/payments/send/${id}`)
  },
}
