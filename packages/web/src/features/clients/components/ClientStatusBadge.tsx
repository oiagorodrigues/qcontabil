import type { ClientStatus } from '@qcontabil/shared'
import { Badge } from '@/components/ui/badge'

const STATUS_CONFIG: Record<
  ClientStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  active: { label: 'Active', variant: 'default' },
  inactive: { label: 'Inactive', variant: 'secondary' },
  churned: { label: 'Churned', variant: 'destructive' },
}

interface ClientStatusBadgeProps {
  status: ClientStatus
}

export function ClientStatusBadge({ status }: ClientStatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}
