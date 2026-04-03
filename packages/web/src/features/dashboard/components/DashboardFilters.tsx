import type { DashboardPeriod } from '@qcontabil/shared'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: 'month', label: 'Este mês' },
  { value: 'quarter', label: 'Este trimestre' },
  { value: 'year', label: 'Este ano' },
  { value: 'last12', label: 'Últimos 12 meses' },
]

interface DashboardFiltersProps {
  period: DashboardPeriod
  currency: string
  availableCurrencies: string[]
  onPeriodChange: (period: DashboardPeriod) => void
  onCurrencyChange: (currency: string) => void
}

export function DashboardFilters({
  period,
  currency,
  availableCurrencies,
  onPeriodChange,
  onCurrencyChange,
}: DashboardFiltersProps) {
  return (
    <div className="flex gap-3">
      <Select value={period} onValueChange={(v) => onPeriodChange(v as DashboardPeriod)}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {availableCurrencies.length > 1 && (
        <Select value={currency} onValueChange={onCurrencyChange}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableCurrencies.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
