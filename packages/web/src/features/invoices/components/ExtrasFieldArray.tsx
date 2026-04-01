import { X } from 'lucide-react'
import type { InvoiceExtraInput } from '@qcontabil/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getErrorMessage } from '@/lib/utils'

interface ExtrasArrayState {
  value: InvoiceExtraInput[]
  meta: { errors: unknown[] }
  pushValue: (value: InvoiceExtraInput) => void
  removeValue: (index: number) => void
}

interface ExtraFieldState {
  value: string | number
  meta: { errors: unknown[] }
  handleBlur: () => void
  handleChange: (value: string | number) => void
}

interface ExtrasFieldArrayProps {
  extras: ExtrasArrayState
  renderField: (
    name: string,
    children: (field: ExtraFieldState) => React.ReactNode,
  ) => React.ReactNode
}

const EMPTY_EXTRA: InvoiceExtraInput = {
  description: '',
  amount: 0,
  sortOrder: 0,
}

function formatCurrency(amount: number): string {
  if (isNaN(amount)) return '0.00'
  return amount.toFixed(2)
}

export function ExtrasFieldArray({ extras, renderField }: ExtrasFieldArrayProps) {
  const extrasTotal = extras.value.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Extras</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={extras.value.length >= 20}
          onClick={() => extras.pushValue({ ...EMPTY_EXTRA, sortOrder: extras.value.length })}
        >
          Add extra
        </Button>
      </div>

      {extras.value.length > 0 && (
        <div className="hidden grid-cols-[1fr_100px_32px] gap-2 px-1 sm:grid">
          <span className="text-muted-foreground text-xs font-medium">Description</span>
          <span className="text-muted-foreground text-right text-xs font-medium">Amount</span>
          <span />
        </div>
      )}

      {extras.value.map((_, index) => (
        <div key={index} className="grid grid-cols-[1fr_100px_32px] items-start gap-2">
          {renderField(`extras[${index}].description`, (field) => (
            <div>
              <Input
                value={(field.value as string) || ''}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Performance bonus, reimbursement..."
                aria-invalid={field.meta.errors.length > 0}
              />
              {field.meta.errors.length > 0 && (
                <p className="mt-1 text-xs text-destructive">
                  {getErrorMessage(field.meta.errors[0])}
                </p>
              )}
            </div>
          ))}

          {renderField(`extras[${index}].amount`, (field) => (
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={(field.value as number) ?? ''}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              className="text-right"
            />
          ))}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => extras.removeValue(index)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {extras.value.length > 0 && (
        <div className="flex justify-end border-t pt-2">
          <span className="text-sm font-semibold">
            Extras total: <span className="tabular-nums">{formatCurrency(extrasTotal)}</span>
          </span>
        </div>
      )}
    </div>
  )
}
