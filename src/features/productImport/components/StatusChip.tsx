import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Plus,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '../../../components/ui'
import type { BadgeKind } from '../../../lib/actionStyles'
import type { VariantStatus } from '../planImport'

type ChipKind = VariantStatus | 'check'

const CHIPS: Record<ChipKind, { kind: BadgeKind; label: string; Icon: LucideIcon }> = {
  new: { kind: 'importNew', label: 'New', Icon: Plus },
  exists: { kind: 'importExists', label: 'Already exists', Icon: CheckCircle2 },
  update: { kind: 'importUpdate', label: 'Will update', Icon: RefreshCw },
  error: { kind: 'importError', label: 'Error', Icon: CircleAlert },
  check: { kind: 'importCheck', label: 'Check', Icon: AlertTriangle },
}

/** Status chip: icon + text, never colour alone. */
export function StatusChip({ status }: { status: ChipKind }) {
  const { kind, label, Icon } = CHIPS[status]
  return (
    <Badge kind={kind}>
      <Icon className="mr-1 h-3.5 w-3.5 shrink-0" aria-hidden /> {label}
    </Badge>
  )
}
