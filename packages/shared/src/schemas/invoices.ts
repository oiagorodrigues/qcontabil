import { z } from 'zod'

import { CURRENCIES } from './clients'

export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'cancelled'] as const

export const invoiceStatusSchema = z.enum(INVOICE_STATUSES)

export const invoiceLineItemSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500),
  quantity: z.coerce.number().positive('Quantity must be positive'),
  unitPrice: z.coerce.number().nonnegative('Unit price must be non-negative'),
  sortOrder: z.coerce.number().int(),
})

export const invoiceExtraSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500),
  amount: z.coerce.number().positive('Amount must be positive'),
  sortOrder: z.coerce.number().int(),
})

export const invoiceObjectSchema = z.object({
  clientId: z.uuid({ error: 'Invalid client ID' }),
  issueDate: z.string().min(1, 'Issue date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  currency: z.enum(CURRENCIES),
  description: z.string().min(1, 'Description is required'),
  notes: z.string().optional(),
  paymentInstructions: z.string().optional(),
  lineItems: z.array(invoiceLineItemSchema).min(1, 'At least one line item is required').max(50),
  extras: z.array(invoiceExtraSchema).max(20).optional().default([]),
})

export const createInvoiceSchema = invoiceObjectSchema.refine(
  (data) => new Date(data.dueDate) >= new Date(data.issueDate),
  {
    message: 'Due date must be on or after issue date',
    path: ['dueDate'],
  },
)

export const updateInvoiceSchema = createInvoiceSchema

export const updateInvoiceStatusSchema = z.object({
  status: invoiceStatusSchema,
})

export const listInvoicesQuerySchema = z.object({
  search: z.string().optional(),
  status: invoiceStatusSchema.optional(),
  clientId: z.uuid().optional(),
  sort: z
    .string()
    .regex(
      /^(invoiceNumber|issueDate|dueDate|status|total|createdAt):(asc|desc)$/,
      'Invalid sort format',
    )
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>
export type InvoiceLineItemInput = z.infer<typeof invoiceLineItemSchema>
export type InvoiceExtraInput = z.infer<typeof invoiceExtraSchema>
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>
export type UpdateInvoiceStatusInput = z.infer<typeof updateInvoiceStatusSchema>
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>
