import { Star, X } from 'lucide-react'
import type { ContactInput } from '@qcontabil/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getErrorMessage } from '@/lib/utils'

interface ContactFieldState {
  value: string | boolean
  meta: { errors: unknown[] }
  handleBlur: () => void
  handleChange: (value: string | boolean) => void
}

interface ContactsArrayState {
  value: ContactInput[]
  meta: { errors: unknown[] }
  pushValue: (value: ContactInput) => void
  removeValue: (index: number) => void
}

interface ContactsFieldArrayProps {
  contacts: ContactsArrayState
  renderField: (
    name: string,
    children: (field: ContactFieldState) => React.ReactNode,
  ) => React.ReactNode
  setFieldValue: (name: string, value: boolean) => void
}

const EMPTY_CONTACT: ContactInput = {
  name: '',
  email: '',
  phone: '',
  role: '',
  isPrimary: false,
}

function ContactTextField({
  field,
  id,
  label,
  placeholder,
  type,
  required,
}: {
  field: ContactFieldState
  id: string
  label: string
  placeholder: string
  type?: string
  required?: boolean
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>
        {label}
        {required && ' *'}
      </Label>
      <Input
        id={id}
        type={type}
        value={(field.value as string) || ''}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={field.meta.errors.length > 0}
      />
      {field.meta.errors.length > 0 && (
        <p className="text-sm text-destructive">{getErrorMessage(field.meta.errors[0])}</p>
      )}
    </div>
  )
}

export function ContactsFieldArray({
  contacts,
  renderField,
  setFieldValue,
}: ContactsFieldArrayProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Contacts</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => contacts.pushValue({ ...EMPTY_CONTACT })}
        >
          Add contact
        </Button>
      </div>

      {contacts.value.map((_, index) => (
        <div key={index} className="relative space-y-3 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm font-medium">Contact {index + 1}</span>
            <div className="flex items-center gap-1">
              {renderField(`contacts[${index}].isPrimary`, (field) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  title={field.value ? 'Primary contact' : 'Set as primary'}
                  onClick={() => {
                    contacts.value.forEach((__, i) => {
                      setFieldValue(`contacts[${i}].isPrimary`, i === index)
                    })
                  }}
                >
                  <Star
                    className={`h-4 w-4 ${field.value ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                  />
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={contacts.value.length <= 1}
                onClick={() => contacts.removeValue(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {renderField(`contacts[${index}].name`, (field) => (
              <ContactTextField
                field={field}
                id={`contact-name-${index}`}
                label="Name"
                placeholder="John Doe"
                required
              />
            ))}

            {renderField(`contacts[${index}].email`, (field) => (
              <ContactTextField
                field={field}
                id={`contact-email-${index}`}
                label="Email"
                placeholder="john@company.com"
                type="email"
                required
              />
            ))}

            {renderField(`contacts[${index}].phone`, (field) => (
              <ContactTextField
                field={field}
                id={`contact-phone-${index}`}
                label="Phone"
                placeholder="+1 555 123 4567"
              />
            ))}

            {renderField(`contacts[${index}].role`, (field) => (
              <ContactTextField
                field={field}
                id={`contact-role-${index}`}
                label="Role"
                placeholder="CTO, Accounts Payable..."
              />
            ))}
          </div>
        </div>
      ))}

      {contacts.meta.errors.length > 0 && (
        <p className="text-sm text-destructive">{getErrorMessage(contacts.meta.errors[0])}</p>
      )}
    </div>
  )
}
