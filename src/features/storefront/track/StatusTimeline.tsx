import { Check } from 'lucide-react'
import { t } from '../i18n'
import type { CustomerOrder } from '../types'
import { orderEnding, orderSteps } from './timeline'

/** Placed, Confirmed, Ready, Delivered, or how the order ended (the shop's reason is shown by the order page). */
export function StatusTimeline({ order }: { order: Pick<CustomerOrder, 'status' | 'confirmation_status'> }) {
  const ending = orderEnding(order)
  if (ending) {
    return (
      <p role="status" className="rounded-xl bg-danger-soft px-3 py-2 font-medium text-danger-ink">
        {t(ending === 'declined' ? 'order.declined' : 'order.cancelled')}
      </p>
    )
  }
  return (
    <ol className="flex items-start justify-between gap-1" aria-label={t('order.progress')}>
      {orderSteps(order).map((s) => (
        <li key={s.key} className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center" aria-current={s.state === 'current' ? 'step' : undefined}>
          <span className={`grid h-8 w-8 place-items-center rounded-full border text-sm ${s.state === 'done' ? 'border-success bg-success-soft text-success-ink' : s.state === 'current' ? 'border-text bg-surface-2' : 'border-border text-muted'}`}>
            {s.state === 'done' ? <Check className="h-4 w-4" aria-hidden /> : null}
          </span>
          <span className={`text-xs ${s.state === 'todo' ? 'text-muted' : 'font-medium'}`}>{t(`order.step.${s.key}`)}</span>
          <span className="sr-only">{t(`order.state.${s.state}`)}</span>
        </li>
      ))}
    </ol>
  )
}
