import { useSearchParams } from 'react-router-dom'
import { Page } from '../../app/Page'
import { SegmentedControl } from '../../components/ui'
import { ACTIVITY_TABS, type ActivityTab } from './api/activityApi'
import { ActivityFeed } from './components/ActivityFeed'
import { EntityList } from './components/EntityList'

const TABS: { value: ActivityTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'order', label: 'Orders' },
  { value: 'product', label: 'Products' },
  { value: 'variant', label: 'Variants' },
]

/**
 * Activity: what happened, in plain words. "All" is one feed by day; Orders / Products / Variants
 * list the things themselves (orders by #number) and each opens its own log.
 */
export function ActivityPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab')
  const tab = ACTIVITY_TABS.find((t) => t === raw) ?? 'all'
  const setTab = (t: ActivityTab) => setParams(t === 'all' ? {} : { tab: t }, { replace: true })

  return (
    <Page title="Activity" back="/more">
      <div className="flex flex-col gap-3">
        <SegmentedControl label="Show" options={TABS} value={tab} onChange={setTab} />
        {tab === 'all' ? <ActivityFeed tab="all" entityId={null} /> : <EntityList kind={tab} />}
      </div>
    </Page>
  )
}
