import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Page } from '../../../app/Page'
import { EmptyState } from '../../../components/ui'
import { useCanWrite } from '../hooks/usePlan'

/**
 * A screen that adds or changes things (new order, edit order, product editor, import). While the plan has
 * ended the shop is read-only, so instead of a form that fails at the last tap there is one clear message.
 * The database refuses these writes anyway; this only stops the screen from offering them.
 */
export function WriteGate({ title, children }: { title: string; children: ReactNode }) {
  const canWrite = useCanWrite()
  if (canWrite) return <>{children}</>
  return (
    <Page title={title} back="/">
      <EmptyState
        title="The shop is read-only"
        description="Your plan has ended, so orders and products cannot be added or changed. Your data is safe."
        action={
          <Link to="/plan" className="font-medium underline underline-offset-4">
            See plans
          </Link>
        }
      />
    </Page>
  )
}
