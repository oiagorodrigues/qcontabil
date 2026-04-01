import type { InvoiceStatus } from '@qcontabil/shared'
import { Badge } from '@/components/ui/badge'

const STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; className: string }
> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700 hover:bg-gray-100' },
  sent: { label: 'Sent', className: 'bg-blue-100 text-blue-700 hover:bg-blue-100' },
  paid: { label: 'Paid', className: 'bg-green-100 text-green-700 hover:bg-green-100' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 hover:bg-red-100' },
}

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  return <Badge className={config.className}>{config.label}</Badge>
}
