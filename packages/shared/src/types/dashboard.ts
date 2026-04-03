import type { Currency } from '../schemas/clients'
import type { InvoiceSummary } from './invoices'

export type DashboardPeriod = 'month' | 'quarter' | 'year' | 'last12'

export interface SummaryCard {
  total: number
  percentChange: number | null
}

export interface InvoiceCountByStatus {
  draft: number
  sent: number
  paid: number
  cancelled: number
}

export interface DashboardSummaryResponse {
  totalBilled: SummaryCard
  totalPending: SummaryCard
  totalReceived: SummaryCard
  invoiceCount: InvoiceCountByStatus
  recentInvoices: InvoiceSummary[]
  availableCurrencies: Currency[]
  defaultCurrency: Currency
}

export interface ChartDataPoint {
  label: string
  total: number
}

export interface DashboardChartResponse {
  data: ChartDataPoint[]
}

export interface TopClientEntry {
  clientId: string
  clientName: string
  total: number
  percentage: number
}

export interface DashboardTopClientsResponse {
  clients: TopClientEntry[]
}
