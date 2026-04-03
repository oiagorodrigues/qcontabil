import { Link } from 'react-router'
import type { DashboardTopClientsResponse } from '@qcontabil/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TopClientsTableProps {
  data: DashboardTopClientsResponse
  currency: string
}

export function TopClientsTable({ data, currency }: TopClientsTableProps) {
  return (
    <Card className="w-full lg:w-80">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Top Clientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados para o período</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium">#</th>
                <th className="pb-2 font-medium">Cliente</th>
                <th className="pb-2 text-right font-medium">Total</th>
                <th className="pb-2 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {data.clients.map((client, idx) => (
                <tr key={client.clientId} className="border-b last:border-0">
                  <td className="py-2 text-muted-foreground">{idx + 1}</td>
                  <td className="py-2">
                    <Link
                      to={`/clients/${client.clientId}`}
                      className="font-medium hover:underline"
                    >
                      {client.clientName}
                    </Link>
                  </td>
                  <td className="py-2 text-right">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
                      client.total,
                    )}
                  </td>
                  <td className="py-2 text-right text-muted-foreground">{client.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}
