import { useSearchParams } from 'react-router-dom'
import { Page } from '../../app/Page'
import { OrderListView } from './components/OrderListView'
import { isOrderTab } from './pipeline'

/** Every order, any status: search by name, phone, order or bill no., filter by status. */
export function AllOrdersPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab = isOrderTab(raw) ? raw : 'all'

  return (
    <Page title="All orders" back="/">
      <OrderListView
        tab={tab}
        onTab={(t) => setParams(t === 'all' ? {} : { tab: t }, { replace: true })}
      />
    </Page>
  )
}
