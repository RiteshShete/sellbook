import type { AuditRow } from './api/activityApi'

export type ActivityKind = 'order' | 'product' | 'variant'

export interface ActivityLine {
  kind: ActivityKind
  /** Where the log of this thing lives: /activity/<kind>/<id>. */
  entityId: string | null
  /** What it happened to: "#13 · Rahul", "Besan", "Retail". */
  heading: string
  /** What happened, in plain words: "Marked ready". */
  text: string
}

const STATUS_TEXT: Record<string, string> = {
  new: 'Moved back to new',
  ready: 'Marked ready',
  delivered: 'Marked delivered',
  cancelled: 'Cancelled',
}

/** The audit trail stores developer-style summaries; this turns the detail part into plain words. */
export function humanizeOrderDetail(detail: string): string {
  const status = /^Status: \w+ → (\w+)$/.exec(detail)
  if (status) return STATUS_TEXT[status[1] ?? ''] ?? `Status changed to ${status[1] ?? ''}`
  const paid = /^Payment: paid \((\w+)\)$/.exec(detail)
  if (paid) return `Marked paid (${paid[1] ?? ''})`
  if (detail === 'Payment: pending') return 'Payment set back to pending'
  const bill = /^bill no\. (\S+), revision (\d+)$/.exec(detail)
  if (bill) return `Bill ${bill[1] ?? ''} made (revision ${bill[2] ?? ''})`
  const rolled = /^Rolled back to version (\d+)$/.exec(detail)
  if (rolled) return `Order restored to an earlier version (${rolled[1] ?? ''})`
  return detail
}

const CATALOG_TEXT: Record<string, string> = {
  added: 'Added',
  updated: 'Edited',
  'moved to Trash': 'Moved to Trash',
  restored: 'Restored from Trash',
}

/** One audit row as heading + text, or null for rows the Activity screen does not show (settings). */
export function describeActivity(row: AuditRow): ActivityLine | null {
  if (row.entity === 'settings') return null
  if (row.entity === 'order' || row.entity === 'bill') {
    const m = /^#(\d+) (.*?): (.*)$/.exec(row.summary)
    return {
      kind: 'order',
      entityId: row.entity_id,
      heading: m ? `#${m[1] ?? ''} · ${m[2] ?? ''}` : 'Order',
      text: humanizeOrderDetail(m ? (m[3] ?? '') : row.summary),
    }
  }
  const m = /^(?:Product|Variant) (.+) (added|updated|moved to Trash|restored)$/.exec(row.summary)
  return {
    kind: row.entity,
    entityId: row.entity_id,
    heading: m
      ? `${row.entity === 'product' ? 'Product' : 'Variant'} · ${m[1] ?? ''}`
      : row.summary,
    text: m ? (CATALOG_TEXT[m[2] ?? ''] ?? row.summary) : row.summary,
  }
}
