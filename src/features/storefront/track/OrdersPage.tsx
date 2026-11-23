import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { EmptyState, ErrorState, Skeleton } from '../../../components/ui'
import { formatDate } from '../../../lib/dates'
import { formatINR } from '../../../lib/money'
import { useAuth } from '../../auth/useAuth'
import { useMyOrders } from '../hooks/useStore'
import { t } from '../i18n'
import { storefrontPath } from '../paths'
import { StoreShell } from '../StorefrontLayout'
import { orderEnding } from './timeline'

const labelOf = (o: { status: string; confirmation_status: string }) => {
  const ending = orderEnding({ status: o.status as 'new', confirmation_status: o.confirmation_status as 'pending' })
  if (ending) return t(ending === 'declined' ? 'order.declined.short' : 'order.cancelled.short')
  if (o.status === 'delivered') return t('order.step.delivered')
  if (o.status === 'ready') return t('order.step.ready')
  return o.confirmation_status === 'pending' ? t('order.waiting') : t('order.step.confirmed')
}

/** /<shop>/orders: the customer's orders at this shop, newest first. */
export function OrdersPage() {
  const { slug = '' } = useParams()
  const location = useLocation()
  const { status } = useAuth()
  const orders = useMyOrders(slug)

  if (status === 'signedOut') return <Navigate to={storefrontPath(slug, 'login')} replace state={{ from: location.pathname }} />
  return (
    <StoreShell title={t('orders.title')}>
      {orders.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : orders.isError ? (
        <ErrorState error={orders.error} onRetry={() => void orders.refetch()} />
      ) : orders.data.length === 0 ? (
        <EmptyState title={t('orders.empty')} description={t('orders.emptyBody')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {orders.data.map((o) => (
            <li key={o.id}>
              <Link to={`${storefrontPath(slug, 'orders')}/${o.id}`} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2">
                <span>
                  <span className="block font-medium">{t('order.no', { no: o.order_no })}</span>
                  <span className="block text-sm text-muted">{formatDate(o.created_at)} · {labelOf(o)}</span>
                </span>
                <span className="font-medium">{formatINR(o.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </StoreShell>
  )
}
