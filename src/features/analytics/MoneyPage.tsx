import { useSearchParams } from 'react-router-dom'
import { Page } from '../../app/Page'
import { UnderlineTabs } from '../../components/ui'
import { AnalyticsReports } from './AnalyticsPage'
import { PendingBody } from './PendingPage'

type View = 'pending' | 'reports'

const VIEWS: { value: View; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'reports', label: 'Reports' },
]

/** Money: who still owes you (first, it is the one to act on) and the monthly reports, on one screen. */
export function MoneyPage() {
  const [params, setParams] = useSearchParams()
  const view: View = params.get('view') === 'reports' ? 'reports' : 'pending'
  const tabs = (
    <UnderlineTabs
      label="Money view"
      options={VIEWS}
      value={view}
      onChange={(v) => setParams(v === 'reports' ? { view: 'reports' } : {}, { replace: true })}
    />
  )

  // Reports brings its own header actions (month, CSV), so each view owns its Page.
  if (view === 'reports') return <AnalyticsReports tabs={tabs} />
  return (
    <Page title="Money">
      <div className="flex flex-col gap-4">
        {tabs}
        <PendingBody />
      </div>
    </Page>
  )
}
