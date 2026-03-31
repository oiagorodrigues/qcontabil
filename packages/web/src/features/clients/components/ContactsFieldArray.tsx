import { Star, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getErrorMessage } from '@/lib/utils'

interface ContactsFieldArrayProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any
}

const EMPTY_CONTACT = {
  name: '',
  email: '',
  phone: '',
  role: '',
  isPrimary: false,
}

export function ContactsFieldArray({ form }: ContactsFieldArrayProps) {
  return (
    <form.Field name="contacts" mode="array">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {(contactsField: any) => (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Contacts</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => contactsField.pushValue({ ...EMPTY_CONTACT })}
            >
              Add contact
            </Button>
          </div>

          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {contactsField.state.value.map((_: any, index: number) => (
            <div key={index} className="relative space-y-3 rounded-md border p-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm font-medium">
                  Contact {index + 1}
                </span>
                <div className="flex items-center gap-1">
                  <form.Field name={`contacts[${index}].isPrimary`}>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(field: any) => (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        title={field.state.value ? 'Primary contact' : 'Set as primary'}
                        onClick={() => {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          contactsField.state.value.forEach((_: any, i: number) => {
                            form.setFieldValue(`contacts[${i}].isPrimary`, i === index)
                          })
                        }}
                      >
                        <Star
                          className={`h-4 w-4 ${field.state.value ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                        />
                      </Button>
                    )}
                  </form.Field>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={contactsField.state.value.length <= 1}
                    onClick={() => contactsField.removeValue(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <form.Field name={`contacts[${index}].name`}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(field: any) => (
                    <div className="space-y-1">
                      <Label htmlFor={`contact-name-${index}`}>Name *</Label>
                      <Input
                        id={`contact-name-${index}`}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          field.handleChange(e.target.value)
                        }
                        placeholder="John Doe"
                        aria-invalid={field.state.meta.errors.length > 0}
                      />
                      {field.state.meta.errors.length > 0 && (
                        <p className="text-sm text-destructive">
                          {getErrorMessage(field.state.meta.errors[0])}
                        </p>
                      )}
                    </div>
                  )}
                </form.Field>

                <form.Field name={`contacts[${index}].email`}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(field: any) => (
                    <div className="space-y-1">
                      <Label htmlFor={`contact-email-${index}`}>Email *</Label>
                      <Input
                        id={`contact-email-${index}`}
                        type="email"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          field.handleChange(e.target.value)
                        }
                        placeholder="john@company.com"
                        aria-invalid={field.state.meta.errors.length > 0}
                      />
                      {field.state.meta.errors.length > 0 && (
                        <p className="text-sm text-destructive">
                          {getErrorMessage(field.state.meta.errors[0])}
                        </p>
                      )}
                    </div>
                  )}
                </form.Field>

                <form.Field name={`contacts[${index}].phone`}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(field: any) => (
                    <div className="space-y-1">
                      <Label htmlFor={`contact-phone-${index}`}>Phone</Label>
                      <Input
                        id={`contact-phone-${index}`}
                        value={field.state.value || ''}
                        onBlur={field.handleBlur}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          field.handleChange(e.target.value)
                        }
                        placeholder="+1 555 123 4567"
                      />
                    </div>
                  )}
                </form.Field>

                <form.Field name={`contacts[${index}].role`}>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(field: any) => (
                    <div className="space-y-1">
                      <Label htmlFor={`contact-role-${index}`}>Role</Label>
                      <Input
                        id={`contact-role-${index}`}
                        value={field.state.value || ''}
                        onBlur={field.handleBlur}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          field.handleChange(e.target.value)
                        }
                        placeholder="CTO, Accounts Payable..."
                      />
                    </div>
                  )}
                </form.Field>
              </div>
            </div>
          ))}

          {contactsField.state.meta.errors.length > 0 && (
            <p className="text-sm text-destructive">
              {getErrorMessage(contactsField.state.meta.errors[0])}
            </p>
          )}
        </div>
      )}
    </form.Field>
  )
}
