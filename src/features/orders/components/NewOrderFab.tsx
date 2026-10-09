import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

/**
 * The app's main action, floating above the tab bar on Home and Delivery. It sits apart from the
 * header so it is never confused with a screen's own header action (e.g. "Add product").
 */
export function NewOrderFab() {
  return (
    <Link
      to="/orders/new"
      className="fixed right-4 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+1rem)] z-30 inline-flex min-h-14 items-center gap-2 rounded-full bg-primary pr-6 pl-5 font-semibold text-primary-fg shadow-lg active:bg-primary-active"
    >
      <Plus className="h-5 w-5" /> New order
    </Link>
  )
}

/** Bottom space so the floating button never covers the last card's buttons. */
export const FAB_CLEARANCE = 'pb-20'
