import { EmptyState } from '../components/ui'
import { Page } from './Page'

export function PlaceholderPage({ title, note }: { title: string; note: string }) {
  return (
    <Page title={title}>
      <EmptyState title={`${title} coming soon`} description={note} />
    </Page>
  )
}
