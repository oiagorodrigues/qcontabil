import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { DashboardChartResponse } from '@qcontabil/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface RevenueChartProps {
  data: DashboardChartResponse
  currency: string
}

function makeTooltip(currency: string) {
  return function ChartTooltip({
    active,
    payload,
    label,
  }: {
    active?: boolean
    payload?: { value?: number }[]
    label?: string
  }) {
    if (!active || !payload?.length) return null
    const value = payload[0].value ?? 0
    return (
      <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-md">
        <p className="font-medium">{label}</p>
        <p className="text-muted-foreground">
          {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)}
        </p>
      </div>
    )
  }
}

export function RevenueChart({ data, currency }: RevenueChartProps) {
  const isEmpty = data.data.every((d) => d.total === 0)

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Faturamento Mensal
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Sem dados para o período selecionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) =>
                  new Intl.NumberFormat('en-US', {
                    notation: 'compact',
                    style: 'currency',
                    currency,
                  }).format(v)
                }
              />
              <Tooltip content={makeTooltip(currency)} />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
