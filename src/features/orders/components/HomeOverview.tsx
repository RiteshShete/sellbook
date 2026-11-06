import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import cardDeliver from '../../../assets/home/card-deliver.png'
import cardPrepare from '../../../assets/home/card-prepare.png'
import cardUnpaid from '../../../assets/home/card-unpaid.png'
import { Skeleton } from '../../../components/ui'
import { addMoney, formatINR } from '../../../lib/money'
import { usePendingPayments } from '../../analytics/hooks/useAnalytics'
import { useOrders } from '../hooks/useOrders'

/**
 * Where the work stands, at a glance. Each card is a link to the screen where that work is done:
 *  - To prepare: the number of New orders; opens Home's "To prepare" view (items added up per product)
 *  - To deliver: the number of Ready orders; opens Delivery
 *  - Unpaid: money still owed on DELIVERED orders not marked paid (B5: Outstanding); opens Pending payments.
 *    A Ready order is not in it until it is delivered.
 */
export function HomeOverview() {
  const fresh = useOrders('new', '')
  const ready = useOrders('ready', '')
  const pending = usePendingPayments()
  const unpaid = pending.data ? addMoney(...pending.data.map((p) => p.total)) : undefined

  return (
    <div className="grid grid-cols-3 gap-2">
      <Card
        tone="bg-(image:--card-prepare)"
        art={{ src: cardPrepare, className: 'top-[-16px] right-[-12px] w-[64%] max-w-[75px]' }}
        label="To prepare"
        value={cardValue(fresh.isError, fresh.data?.length)}
        to="/?view=prep"
      />
      <Card
        tone="bg-(image:--card-deliver)"
        art={{ src: cardDeliver, className: 'top-[-6px] right-[-11px] w-[56%] max-w-[65px]' }}
        label="To deliver"
        value={cardValue(ready.isError, ready.data?.length)}
        to="/delivery"
      />
      <Card
        tone="bg-(image:--card-unpaid)"
        art={{ src: cardUnpaid, className: 'top-[-11px] right-[-22px] w-[61%] max-w-[71px]' }}
        label="Unpaid"
        value={cardValue(pending.isError, unpaid === undefined ? undefined : formatINR(unpaid))}
        to="/pending"
      />
    </div>
  )
}

/** A failed query shows a dash (the card still opens its screen, which has the retry), never a stuck skeleton. */
function cardValue(failed: boolean, value: ReactNode | undefined): ReactNode | undefined {
  return failed ? '—' : value
}

interface CardProps {
  /** Background gradient class. */
  tone: string
  /** Decorative picture in the top-right corner; placed in % of the card so it scales with it. */
  art: { src: string; className: string }
  label: string
  value: ReactNode | undefined
  to: string
}

function Card({ tone, art, label, value, to }: CardProps) {
  return (
    <Link
      to={to}
      replace={to.startsWith('/?')}
      className={`relative flex min-h-20 min-w-0 flex-col justify-between overflow-hidden rounded-2xl p-3 text-left text-text ${tone}`}
    >
      <img
        src={art.src}
        alt=""
        aria-hidden
        className={`pointer-events-none absolute aspect-square object-cover ${art.className}`}
      />
      {value === undefined ? (
        <Skeleton className="relative mt-1 h-7 w-12" />
      ) : (
        <span className="relative block truncate text-2xl leading-tight font-semibold tracking-tight tabular-nums">
          {value}
        </span>
      )}
      <span className="relative text-sm font-medium text-text/70">{label}</span>
    </Link>
  )
}
