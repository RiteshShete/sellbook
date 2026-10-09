import { Plus } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Page } from '../../app/Page'
import { SegmentedControl } from '../../components/ui'
import type { OrderTab } from './api/ordersApi'
import { OrderListView } from './components/OrderListView'
import { PrepList } from './components/PrepList'
import { isOrderTab } from './pipeline'

type View = 'orders' | 'prep'

const VIEWS: { value: View; label: string }[] = [
  { value: 'orders', label: 'Orders' },
  { value: 'prep', label: 'To prepare' },
]

const newLink =
  'inline-flex min-h-11 items-center gap-1 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-fg'

/** Orders screen, split in two: the order list, and what to prepare for New orders. */
export function OrdersPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab: OrderTab = isOrderTab(raw) ? raw : 'new'
  const view: View = params.get('view') === 'prep' ? 'prep' : 'orders'

  const action = (
    <Link to="/orders/new" className={newLink}>
      <Plus className="h-5 w-5" /> New
    </Link>
  )

  return (
    <Page title="Orders" action={action}>
      <div className="flex flex-col gap-4">
        <SegmentedControl
          label="View"
          options={VIEWS}
          value={view}
          onChange={(v) =>
            setParams(v === 'prep' ? { view: 'prep', tab } : { tab }, { replace: true })
          }
        />
        {view === 'prep' ? (
          <PrepList />
        ) : (
          <OrderListView
            tab={tab}
            onTab={(t) => setParams({ tab: t }, { replace: true })}
            newAction={action}
          />
        )}
      </div>
    </Page>
  )
}
