import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from './dashboard.api'

interface DashboardParams {
  period: string
  currency?: string
}

export function useDashboardSummary(params: DashboardParams) {
  return useQuery({
    queryKey: ['dashboard', 'summary', params],
    queryFn: () => dashboardApi.getSummary(params).then((r) => r.data),
  })
}

export function useDashboardChart(params: DashboardParams) {
  return useQuery({
    queryKey: ['dashboard', 'chart', params],
    queryFn: () => dashboardApi.getRevenueChart(params).then((r) => r.data),
  })
}

export function useDashboardTopClients(params: DashboardParams) {
  return useQuery({
    queryKey: ['dashboard', 'top-clients', params],
    queryFn: () => dashboardApi.getTopClients(params).then((r) => r.data),
  })
}
