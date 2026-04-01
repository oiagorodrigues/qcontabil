import { X } from 'lucide-react'
import type { InvoiceLineItemInput } from '@qcontabil/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getErrorMessage } from '@/lib/utils'

interface LineItemsArrayState {
  value: InvoiceLineItemInput[]
  meta: { errors: unknown[] }
  pushValue: (value: InvoiceLineItemInput) => void
  removeValue: (index: number) => void
}

interface LineItemFieldState {
  value: string | number
  meta: { errors: unknown[] }
  handleBlur: () => void
  handleChange: (value: string | number) => void
}

interface LineItemsFieldArrayProps {
  lineItems: LineItemsArrayState
  renderField: (
    name: string,
    children: (field: LineItemFieldState) => React.ReactNode,
  ) => React.ReactNode
}

const EMPTY_LINE_ITEM: InvoiceLineItemInput = {
  description: '',
  quantity: 1,
  unitPrice: 0,
  sortOrder: 0,
}

function formatCurrency(amount: number): string {
  if (isNaN(amount)) return '0.00'
  return amount.toFixed(2)
}

export function LineItemsFieldArray({ lineItems, renderField }: LineItemsFieldArrayProps) {
  const subtotal = lineItems.value.reduce((sum, li) => {
    const qty = Number(li.quantity) || 0
    const price = Number(li.unitPrice) || 0
    return sum + qty * price
  }, 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Line Items</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={lineItems.value.length >= 50}
          onClick={() =>
            lineItems.pushValue({ ...EMPTY_LINE_ITEM, sortOrder: lineItems.value.length })
          }
        >
          Add line item
        </Button>
      </div>

      {lineItems.value.length > 0 && (
        <div className="hidden grid-cols-[1fr_80px_100px_80px_32px] gap-2 px-1 sm:grid">
          <span className="text-muted-foreground text-xs font-medium">Description</span>
          <span className="text-muted-foreground text-right text-xs font-medium">Qty</span>
          <span className="text-muted-foreground text-right text-xs font-medium">Rate</span>
          <span className="text-muted-foreground text-right text-xs font-medium">Amount</span>
          <span />
        </div>
      )}

      {lineItems.value.map((li, index) => {
        const qty = Number(li.quantity) || 0
        const price = Number(li.unitPrice) || 0
        const amount = qty * price

        return (
          <div
            key={index}
            className="grid grid-cols-[1fr_80px_100px_80px_32px] items-start gap-2"
          >
            {renderField(`lineItems[${index}].description`, (field) => (
              <div>
                <Input
                  value={(field.value as string) || ''}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Service description"
                  aria-invalid={field.meta.errors.length > 0}
                />
                {field.meta.errors.length > 0 && (
                  <p className="mt-1 text-xs text-destructive">
                    {getErrorMessage(field.meta.errors[0])}
                  </p>
                )}
              </div>
            ))}

            {renderField(`lineItems[${index}].quantity`, (field) => (
              <Input
                type="number"
                min="0"
                step="0.01"
                value={(field.value as number) ?? ''}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="text-right"
              />
            ))}

            {renderField(`lineItems[${index}].unitPrice`, (field) => (
              <Input
                type="number"
                min="0"
                step="0.01"
                value={(field.value as number) ?? ''}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="text-right"
              />
            ))}

            <div className="flex h-9 items-center justify-end px-1">
              <span className="text-sm font-medium tabular-nums">{formatCurrency(amount)}</span>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              disabled={lineItems.value.length <= 1}
              onClick={() => lineItems.removeValue(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )
      })}

      {lineItems.meta.errors.length > 0 && (
        <p className="text-sm text-destructive">{getErrorMessage(lineItems.meta.errors[0])}</p>
      )}

      <div className="flex justify-end border-t pt-2">
        <span className="text-sm font-semibold">
          Subtotal: <span className="tabular-nums">{formatCurrency(subtotal)}</span>
        </span>
      </div>
    </div>
  )
}
