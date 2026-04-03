import { z } from 'zod'

export const CLIENT_STATUSES = ['active', 'inactive', 'churned'] as const
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'BRL', 'CAD', 'AUD', 'JPY', 'CHF'] as const

export const clientStatusSchema = z.enum(CLIENT_STATUSES)
export const currencySchema = z.enum(CURRENCIES)

export const contactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.email({ error: 'Invalid email address' }).transform((e) => e.toLowerCase().trim()),
  phone: z.string().max(50).optional(),
  role: z.string().max(100).optional(),
  isPrimary: z.boolean(),
})

/** Base client object schema — used by frontend form validation */
export const clientObjectSchema = z.object({
  fantasyName: z.string().min(1, 'Fantasy name is required').max(200),
  company: z.string().min(1, 'Company name is required').max(200),
  country: z.string().min(1, 'Country is required').max(100),
  countryCode: z
    .string()
    .length(2, 'Country code must be 2 characters')
    .transform((c) => c.toUpperCase()),
  email: z.email({ error: 'Invalid email address' }).transform((e) => e.toLowerCase().trim()),
  phone: z.string().max(50).optional(),
  website: z.string().max(255).optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  currency: currencySchema,
  status: clientStatusSchema,
  contacts: z.array(contactSchema).min(1, 'At least one contact is required'),
  // Payment settings
  paymentProviderPayeeId: z.string().max(255).nullable().optional(),
  autoSendDay: z.number().int().min(1).max(28).nullable().optional(),
})

/** Full create schema with primary contact refinement — used by backend validation */
export const createClientSchema = clientObjectSchema.refine(
  (data) => data.contacts.filter((c) => c.isPrimary).length === 1,
  {
    message: 'Exactly one contact must be marked as primary',
    path: ['contacts'],
  },
)

export const updateClientSchema = createClientSchema

export const listClientsQuerySchema = z.object({
  search: z.string().optional(),
  status: clientStatusSchema.optional(),
  country: z.string().optional(),
  sort: z
    .string()
    .regex(
      /^(fantasyName|company|country|currency|status|createdAt):(asc|desc)$/,
      'Invalid sort format',
    )
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

export type ContactInput = z.infer<typeof contactSchema>
export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>
export type ClientStatus = z.infer<typeof clientStatusSchema>
export type Currency = z.infer<typeof currencySchema>
