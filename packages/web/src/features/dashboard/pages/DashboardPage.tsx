import { useState } from 'react'
import type { DashboardPeriod } from '@qcontabil/shared'
import { useDashboardSummary, useDashboardChart, useDashboardTopClients } from '../api/dashboard.hooks'
import { DashboardFilters } from '../components/DashboardFilters'
import { SummaryCards } from '../components/SummaryCards'
import { RevenueChart } from '../components/RevenueChart'
import { TopClientsTable } from '../components/TopClientsTable'
import { RecentInvoices } from '../components/RecentInvoices'

export default function DashboardPage() {
  const [period, setPeriod] = useState<DashboardPeriod>('month')
  const [currency, setCurrency] = useState<string | undefined>(undefined)

  const effectiveCurrency = currency ?? 'USD'
  const params = { period, currency }

  const summaryQuery = useDashboardSummary(params)
  const chartQuery = useDashboardChart(params)
  const topClientsQuery = useDashboardTopClients(params)

  // After first load, use the default currency from summary
  const resolvedCurrency =
    currency ?? summaryQuery.data?.defaultCurrency ?? effectiveCurrency

  const availableCurrencies = summaryQuery.data?.availableCurrencies ?? []

  const isLoading = summaryQuery.isLoading || chartQuery.isLoading || topClientsQuery.isLoading

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <DashboardFilters
          period={period}
          currency={resolvedCurrency}
          availableCurrencies={availableCurrencies}
          onPeriodChange={setPeriod}
          onCurrencyChange={setCurrency}
        />
      </div>

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {summaryQuery.data && (
            <SummaryCards data={summaryQuery.data} currency={resolvedCurrency} />
          )}

          <div className="flex flex-col gap-4 lg:flex-row">
            {chartQuery.data && (
              <RevenueChart data={chartQuery.data} currency={resolvedCurrency} />
            )}
            {topClientsQuery.data && (
              <TopClientsTable data={topClientsQuery.data} currency={resolvedCurrency} />
            )}
          </div>

          {summaryQuery.data && (
            <RecentInvoices invoices={summaryQuery.data.recentInvoices} />
          )}
        </>
      )}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="flex gap-4">
        <div className="h-56 flex-1 rounded-xl bg-muted" />
        <div className="h-56 w-80 rounded-xl bg-muted" />
      </div>
      <div className="h-64 rounded-xl bg-muted" />
    </div>
  )
}
