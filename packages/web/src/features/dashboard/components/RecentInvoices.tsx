import { Link } from 'react-router'
import type { InvoiceSummary } from '@qcontabil/shared'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { InvoiceStatusBadge } from '@/features/invoices/components/InvoiceStatusBadge'

interface RecentInvoicesProps {
  invoices: InvoiceSummary[]
}

export function RecentInvoices({ invoices }: RecentInvoicesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Invoices Recentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum invoice encontrado</p>
        ) : (
          <div className="divide-y">
            {invoices.map((invoice) => (
              <Link
                key={invoice.id}
                to={`/invoices/${invoice.id}`}
                className="flex items-center justify-between py-3 hover:bg-muted/50 -mx-2 px-2 rounded transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm">{invoice.invoiceNumber}</span>
                  <span className="text-sm text-muted-foreground">{invoice.clientFantasyName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <InvoiceStatusBadge status={invoice.status} />
                  <span className="text-sm font-medium">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: invoice.currency,
                    }).format(invoice.total)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(invoice.issueDate).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Link to="/invoices" className="text-sm text-primary hover:underline">
          Ver todos →
        </Link>
      </CardFooter>
    </Card>
  )
}
