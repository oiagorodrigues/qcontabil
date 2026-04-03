import { useForm } from '@tanstack/react-form'
import { clientObjectSchema, CLIENT_STATUSES, CURRENCIES } from '@qcontabil/shared'
import type { CreateClientInput, ClientDetail, Currency, ClientStatus } from '@qcontabil/shared'
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
import { ContactsFieldArray } from './ContactsFieldArray'

type ContactFieldPath =
  | `contacts[${number}].name`
  | `contacts[${number}].email`
  | `contacts[${number}].phone`
  | `contacts[${number}].role`
  | `contacts[${number}].isPrimary`

interface ClientFormProps {
  initialData?: ClientDetail
  onSubmit: (data: CreateClientInput) => void
  isSubmitting: boolean
}

function FieldError({ errors }: { errors: unknown[] }) {
  if (errors.length === 0) return null
  return <p className="text-sm text-destructive">{getErrorMessage(errors[0])}</p>
}

export function ClientForm({ initialData, onSubmit, isSubmitting }: ClientFormProps) {
  const form = useForm({
    defaultValues: {
      fantasyName: initialData?.fantasyName || '',
      company: initialData?.company || '',
      country: initialData?.country || '',
      countryCode: initialData?.countryCode || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      website: initialData?.website || '',
      address: initialData?.address || '',
      notes: initialData?.notes || '',
      currency: initialData?.currency || 'USD',
      status: initialData?.status || 'active',
      contacts: initialData?.contacts?.map((c) => ({
        name: c.name,
        email: c.email,
        phone: c.phone || '',
        role: c.role || '',
        isPrimary: c.isPrimary,
      })) || [{ name: '', email: '', phone: '', role: '', isPrimary: true }],
      paymentProviderPayeeId: initialData?.paymentProviderPayeeId ?? null,
      autoSendDay: initialData?.autoSendDay ?? null,
    } as CreateClientInput,
    validators: {
      onSubmit: clientObjectSchema,
    },
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
      <div>
        <h3 className="text-lg font-semibold">Company Information</h3>
        <Separator className="mt-2 mb-4" />
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="fantasyName">
            {(field) => (
              <div className="space-y-1">
                <Label htmlFor="fantasyName">Fantasy Name *</Label>
                <Input
                  id="fantasyName"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Acme Inc"
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field name="company">
            {(field) => (
              <div className="space-y-1">
                <Label htmlFor="company">Legal Name *</Label>
                <Input
                  id="company"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Acme Corporation Ltd"
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field name="email">
            {(field) => (
              <div className="space-y-1">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="billing@acme.com"
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field name="phone">
            {(field) => (
              <div className="space-y-1">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={field.state.value || ''}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="+1 555 123 4567"
                />
              </div>
            )}
          </form.Field>

          <form.Field name="country">
            {(field) => (
              <div className="space-y-1">
                <Label htmlFor="country">Country *</Label>
                <Input
                  id="country"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="United States"
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field name="countryCode">
            {(field) => (
              <div className="space-y-1">
                <Label htmlFor="countryCode">Country Code *</Label>
                <Input
                  id="countryCode"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value.toUpperCase())}
                  placeholder="US"
                  maxLength={2}
                  aria-invalid={field.state.meta.errors.length > 0}
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
                  onValueChange={(v) => field.handleChange(v as Currency)}
                >
                  <SelectTrigger id="currency">
                    <SelectValue placeholder="Select currency" />
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

          <form.Field name="status">
            {(field) => (
              <div className="space-y-1">
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as ClientStatus)}
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field name="website">
            {(field) => (
              <div className="space-y-1">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={field.state.value || ''}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="https://acme.com"
                />
              </div>
            )}
          </form.Field>

          <form.Field name="address">
            {(field) => (
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={field.state.value || ''}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="123 Main St, Suite 100, San Francisco, CA 94105"
                />
              </div>
            )}
          </form.Field>

          <form.Field name="notes">
            {(field) => (
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={field.state.value || ''}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="Any additional notes about this client..."
                  rows={3}
                />
              </div>
            )}
          </form.Field>
        </div>
      </div>

      <div>
        <form.Field name="contacts" mode="array">
          {(contactsField) => (
            <ContactsFieldArray
              contacts={{
                value: contactsField.state.value,
                meta: contactsField.state.meta,
                pushValue: contactsField.pushValue,
                removeValue: contactsField.removeValue,
              }}
              renderField={(name, children) => (
                <form.Field name={name as ContactFieldPath} key={name}>
                  {(field) =>
                    children({
                      value: field.state.value as string | boolean,
                      meta: field.state.meta,
                      handleBlur: field.handleBlur,
                      handleChange: field.handleChange as (value: string | boolean) => void,
                    })
                  }
                </form.Field>
              )}
              setFieldValue={(name, value) => form.setFieldValue(name as ContactFieldPath, value)}
            />
          )}
        </form.Field>
      </div>

      <div>
        <h3 className="text-lg font-semibold">Payment Settings</h3>
        <Separator className="mt-2 mb-4" />
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="paymentProviderPayeeId">
            {(field) => (
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="paymentProviderPayeeId">Payment Platform ID</Label>
                <Input
                  id="paymentProviderPayeeId"
                  value={field.state.value ?? ''}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value || null)}
                  placeholder="e.g. Tipalti Payee ID"
                />
                <p className="text-xs text-muted-foreground">
                  The client's ID in your payment platform. Required to send invoices automatically.
                </p>
              </div>
            )}
          </form.Field>

          <form.Field name="autoSendDay">
            {(field) => (
              <div className="space-y-1">
                <Label htmlFor="autoSendDay">Auto-Send Day</Label>
                <Select
                  value={field.state.value != null ? String(field.state.value) : 'disabled'}
                  onValueChange={(v) => field.handleChange(v === 'disabled' ? null : Number(v))}
                >
                  <SelectTrigger id="autoSendDay">
                    <SelectValue placeholder="Disabled" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">Disabled</SelectItem>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                      <SelectItem key={day} value={String(day)}>
                        Day {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Day of month to automatically submit draft invoices.
                </p>
              </div>
            )}
          </form.Field>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : initialData ? 'Update Client' : 'Create Client'}
        </Button>
      </div>
    </form>
  )
}
