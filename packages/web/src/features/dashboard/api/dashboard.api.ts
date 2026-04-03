import type {
  DashboardSummaryResponse,
  DashboardChartResponse,
  DashboardTopClientsResponse,
} from '@qcontabil/shared'
import { httpClient } from '@/lib/http-client'

interface DashboardParams {
  period: string
  currency?: string
}

export const dashboardApi = {
  getSummary(params: DashboardParams) {
    return httpClient.get<DashboardSummaryResponse>('/dashboard/summary', { params })
  },

  getRevenueChart(params: DashboardParams) {
    return httpClient.get<DashboardChartResponse>('/dashboard/revenue-chart', { params })
  },

  getTopClients(params: DashboardParams) {
    return httpClient.get<DashboardTopClientsResponse>('/dashboard/top-clients', { params })
  },
}
