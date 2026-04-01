import { Separator } from '@/components/ui/separator'
import type { CompanyResponse } from '@qcontabil/shared'
import type { ClientDetail } from '@qcontabil/shared'

interface LineItemPreview {
  description: string
  quantity: number
  unitPrice: number
}

interface ExtraPreview {
  description: string
  amount: number
}

interface InvoicePreviewProps {
  company: CompanyResponse | null
  client: ClientDetail | null
  invoiceNumber?: string
  issueDate: string
  dueDate: string
  currency: string
  description: string
  lineItems: LineItemPreview[]
  extras: ExtraPreview[]
  paymentInstructions?: string
}

function formatAmount(amount: number, currency: string): string {
  if (!currency) return amount.toFixed(2)
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
  } catch {
    return amount.toFixed(2)
  }
}

function hasBankInfo(company: CompanyResponse): boolean {
  return !!(
    company.bankBeneficiaryName ||
    company.bankName ||
    company.bankAccountNumber ||
    company.bankSwiftCode
  )
}

export function InvoicePreview({
  company,
  client,
  invoiceNumber,
  issueDate,
  dueDate,
  currency,
  description,
  lineItems,
  extras,
  paymentInstructions,
}: InvoicePreviewProps) {
  const subtotal = lineItems.reduce((sum, li) => sum + (Number(li.quantity) || 0) * (Number(li.unitPrice) || 0), 0)
  const extrasTotal = extras.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  const total = subtotal + extrasTotal
  const fmt = (n: number) => formatAmount(n, currency)

  return (
    <div className="rounded-lg border bg-white p-6 text-sm shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          {company ? (
            <>
              <p className="text-base font-bold">{company.legalName}</p>
              {company.street && (
                <p className="text-muted-foreground text-xs">
                  {[company.street, company.streetNumber, company.city, company.state]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
              <p className="text-muted-foreground text-xs">{company.email}</p>
            </>
          ) : (
            <p className="text-muted-foreground text-xs italic">Company info not set up</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xl font-bold tracking-wide">INVOICE</p>
          {invoiceNumber && (
            <p className="text-muted-foreground text-xs">#{invoiceNumber}</p>
          )}
          {issueDate && <p className="text-muted-foreground text-xs">Issued: {issueDate}</p>}
          {dueDate && <p className="text-muted-foreground text-xs">Due: {dueDate}</p>}
        </div>
      </div>

      <Separator className="my-4" />

      {/* From / To */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            From
          </p>
          {company ? (
            <>
              <p className="font-medium">{company.legalName}</p>
              <p className="text-muted-foreground text-xs">{company.email}</p>
            </>
          ) : (
            <p className="text-muted-foreground text-xs italic">—</p>
          )}
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            To
          </p>
          {client ? (
            <>
              <p className="font-medium">{client.fantasyName}</p>
              <p className="text-muted-foreground text-xs">{client.company}</p>
              <p className="text-muted-foreground text-xs">{client.email}</p>
              {client.address && (
                <p className="text-muted-foreground text-xs">{client.address}</p>
              )}
              <p className="text-muted-foreground text-xs">{client.country}</p>
            </>
          ) : (
            <p className="text-muted-foreground text-xs italic">Select a client</p>
          )}
        </div>
      </div>

      {description && (
        <>
          <Separator className="my-4" />
          <p className="text-muted-foreground text-xs">{description}</p>
        </>
      )}

      <Separator className="my-4" />

      {/* Services table */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Services
        </p>
        <div className="grid grid-cols-[1fr_60px_80px_80px] gap-1 border-b pb-1 text-xs font-medium text-muted-foreground">
          <span>Description</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Rate</span>
          <span className="text-right">Amount</span>
        </div>
        {lineItems.length === 0 ? (
          <p className="py-2 text-xs italic text-muted-foreground">No line items yet</p>
        ) : (
          lineItems.map((li, i) => {
            const qty = Number(li.quantity) || 0
            const price = Number(li.unitPrice) || 0
            return (
              <div
                key={i}
                className="grid grid-cols-[1fr_60px_80px_80px] gap-1 border-b py-1 text-xs"
              >
                <span>{li.description || '—'}</span>
                <span className="text-right tabular-nums">{qty}</span>
                <span className="text-right tabular-nums">{fmt(price)}</span>
                <span className="text-right tabular-nums">{fmt(qty * price)}</span>
              </div>
            )
          })
        )}
        <div className="flex justify-end pt-1">
          <span className="text-xs font-semibold">Subtotal: {fmt(subtotal)}</span>
        </div>
      </div>

      {/* Extras */}
      {extras.length > 0 && (
        <>
          <Separator className="my-4" />
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Extras
            </p>
            <div className="grid grid-cols-[1fr_80px] gap-1 border-b pb-1 text-xs font-medium text-muted-foreground">
              <span>Description</span>
              <span className="text-right">Amount</span>
            </div>
            {extras.map((e, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_80px] gap-1 border-b py-1 text-xs"
              >
                <span>{e.description || '—'}</span>
                <span className="text-right tabular-nums">{fmt(Number(e.amount) || 0)}</span>
              </div>
            ))}
            <div className="flex justify-end pt-1">
              <span className="text-xs font-semibold">Extras: {fmt(extrasTotal)}</span>
            </div>
          </div>
        </>
      )}

      {/* Total */}
      <Separator className="my-4" />
      <div className="flex justify-end">
        <span className="text-base font-bold">TOTAL: {fmt(total)}</span>
      </div>

      {/* Payment instructions */}
      {(paymentInstructions || (company && hasBankInfo(company))) && (
        <>
          <Separator className="my-4" />
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Payment Instructions
            </p>
            {paymentInstructions && (
              <p className="whitespace-pre-wrap text-xs">{paymentInstructions}</p>
            )}
            {company && hasBankInfo(company) && (
              <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                {company.bankBeneficiaryName && <p>Beneficiary: {company.bankBeneficiaryName}</p>}
                {company.bankName && <p>Bank: {company.bankName}</p>}
                {company.bankAccountNumber && <p>Account: {company.bankAccountNumber}</p>}
                {company.bankSwiftCode && <p>SWIFT: {company.bankSwiftCode}</p>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
