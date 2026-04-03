import { useForm } from '@tanstack/react-form'
import { invoiceObjectSchema, CURRENCIES, INVOICE_TEMPLATES } from '@qcontabil/shared'
import type { ClientSummary, InvoiceLineItemInput, InvoiceExtraInput, InvoiceTemplateType } from '@qcontabil/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { getErrorMessage } from '@/lib/utils'
import { LineItemsFieldArray } from './LineItemsFieldArray'
import { ExtrasFieldArray } from './ExtrasFieldArray'

interface InvoiceFormValues {
  clientId: string
  issueDate: string
  dueDate: string
  currency: string
  template: InvoiceTemplateType
  description: string
  notes: string
  paymentInstructions: string
  lineItems: InvoiceLineItemInput[]
  extras: InvoiceExtraInput[]
}

interface InvoiceFormProps {
  defaultValues?: Partial<InvoiceFormValues>
  onSubmit: (data: InvoiceFormValues) => void
  isSubmitting: boolean
  clients: ClientSummary[]
}

function FieldError({ errors }: { errors: unknown[] }) {
  if (errors.length === 0) return null
  return <p className="text-sm text-destructive">{getErrorMessage(errors[0])}</p>
}

const DEFAULT_LINE_ITEM: InvoiceLineItemInput = {
  description: '',
  quantity: 1,
  unitPrice: 0,
  sortOrder: 0,
}

export function InvoiceForm({ defaultValues, onSubmit, isSubmitting, clients }: InvoiceFormProps) {
  const today = new Date().toISOString().split('T')[0]

  const form = useForm({
    defaultValues: {
      clientId: defaultValues?.clientId ?? '',
      issueDate: defaultValues?.issueDate ?? today,
      dueDate: defaultValues?.dueDate ?? today,
      currency: defaultValues?.currency ?? 'USD',
      template: defaultValues?.template ?? 'classic',
      description: defaultValues?.description ?? '',
      notes: defaultValues?.notes ?? '',
      paymentInstructions: defaultValues?.paymentInstructions ?? '',
      lineItems: defaultValues?.lineItems ?? [{ ...DEFAULT_LINE_ITEM }],
      extras: defaultValues?.extras ?? [],
    } as InvoiceFormValues,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onSubmit: invoiceObjectSchema as any },
    onSubmit: ({ value }) => {
      onSubmit(value)
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
      className="space-y-6"
    >
      {/* Client + Dates + Currency */}
      <div>
        <h3 className="text-lg font-semibold">Invoice Details</h3>
        <Separator className="mb-4 mt-2" />

        <div className="space-y-4">
          <form.Field name="clientId">
            {(field) => (
              <div className="space-y-1">
                <Label htmlFor="clientId">Client *</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(val) => {
                    field.handleChange(val)
                    const client = clients.find((c) => c.id === val)
                    if (client) {
                      form.setFieldValue('currency', client.currency)
                    }
                  }}
                >
                  <SelectTrigger id="clientId">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.fantasyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <form.Field name="issueDate">
              {(field) => (
                <div className="space-y-1">
                  <Label htmlFor="issueDate">Issue Date *</Label>
                  <Input
                    id="issueDate"
                    type="date"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </div>
              )}
            </form.Field>

            <form.Field name="dueDate">
              {(field) => (
                <div className="space-y-1">
                  <Label htmlFor="dueDate">Due Date *</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </div>
              )}
            </form.Field>

            <form.Field name="currency">
              {(field) => (
                <div className="space-y-1">
                  <Label htmlFor="currency">Currency *</Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(val) => field.handleChange(val)}
                  >
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError errors={field.state.meta.errors} />
                </div>
              )}
            </form.Field>
          </div>

          <form.Field name="template">
            {(field) => (
              <div className="space-y-1">
                <Label htmlFor="template">Template</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(val) => field.handleChange(val as InvoiceTemplateType)}
                >
                  <SelectTrigger id="template">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOICE_TEMPLATES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field name="description">
            {(field) => (
              <div className="space-y-1">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Services rendered for..."
                  rows={2}
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>
        </div>
      </div>

      {/* Line Items */}
      <div>
        <Separator className="mb-4" />
        <form.Field name="lineItems" mode="array">
          {(lineItemsField) => (
            <LineItemsFieldArray
              lineItems={{
                value: lineItemsField.state.value,
                meta: lineItemsField.state.meta,
                pushValue: (v) => lineItemsField.pushValue(v),
                removeValue: (i) => lineItemsField.removeValue(i),
              }}
              renderField={(name, children) => (
                <form.Field name={name as Parameters<typeof form.Field>[0]['name']}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(field: any) =>
                    children({
                      value: field.state.value,
                      meta: field.state.meta,
                      handleBlur: field.handleBlur,
                      handleChange: field.handleChange,
                    })
                  }
                </form.Field>
              )}
            />
          )}
        </form.Field>
      </div>

      {/* Extras */}
      <div>
        <Separator className="mb-4" />
        <form.Field name="extras" mode="array">
          {(extrasField) => (
            <ExtrasFieldArray
              extras={{
                value: extrasField.state.value,
                meta: extrasField.state.meta,
                pushValue: (v) => extrasField.pushValue(v),
                removeValue: (i) => extrasField.removeValue(i),
              }}
              renderField={(name, children) => (
                <form.Field name={name as Parameters<typeof form.Field>[0]['name']}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(field: any) =>
                    children({
                      value: field.state.value,
                      meta: field.state.meta,
                      handleBlur: field.handleBlur,
                      handleChange: field.handleChange,
                    })
                  }
                </form.Field>
              )}
            />
          )}
        </form.Field>
      </div>

      {/* Payment Instructions + Notes */}
      <div>
        <Separator className="mb-4" />
        <div className="space-y-4">
          <form.Field name="paymentInstructions">
            {(field) => (
              <div className="space-y-1">
                <Label htmlFor="paymentInstructions">Payment Instructions</Label>
                <Textarea
                  id="paymentInstructions"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Bank transfer to..."
                  rows={3}
                />
              </div>
            )}
          </form.Field>

          <form.Field name="notes">
            {(field) => (
              <div className="space-y-1">
                <Label htmlFor="notes">Internal Notes</Label>
                <Textarea
                  id="notes"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Private notes (not shown on PDF)"
                  rows={2}
                />
              </div>
            )}
          </form.Field>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save Invoice'}
      </Button>
    </form>
  )
}
