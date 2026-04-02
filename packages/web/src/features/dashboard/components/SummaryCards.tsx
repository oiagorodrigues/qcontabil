import type { DashboardSummaryResponse } from '@qcontabil/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface SummaryCardsProps {
  data: DashboardSummaryResponse
  currency: string
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)
}

function PercentBadge({ value }: { value: number | null }) {
  if (value === null) return null
  const positive = value >= 0
  return (
    <span
      className={cn(
        'text-xs font-medium',
        positive ? 'text-green-600' : 'text-red-600',
      )}
    >
      {positive ? '+' : ''}
      {value}%
    </span>
  )
}

export function SummaryCards({ data, currency }: SummaryCardsProps) {
  const totalInvoices =
    data.invoiceCount.draft +
    data.invoiceCount.sent +
    data.invoiceCount.paid +
    data.invoiceCount.cancelled

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Faturado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {formatCurrency(data.totalBilled.total, currency)}
          </p>
          <PercentBadge value={data.totalBilled.percentChange} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Pendente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {formatCurrency(data.totalPending.total, currency)}
          </p>
          <PercentBadge value={data.totalPending.percentChange} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Recebido</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {formatCurrency(data.totalReceived.total, currency)}
          </p>
          <PercentBadge value={data.totalReceived.percentChange} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{totalInvoices}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            <span>Draft: {data.invoiceCount.draft}</span>
            <span>Sent: {data.invoiceCount.sent}</span>
            <span>Paid: {data.invoiceCount.paid}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
