import { BarChart3, Ellipsis, House, Package, Truck } from 'lucide-react'
import type { ComponentType } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useOrders } from '../features/orders/hooks/useOrders'

interface Tab {
  to: string
  label: string
  Icon: ComponentType<{ className?: string }>
  /** Also active on these path prefixes (e.g. Home for order screens). */
  alsoActive?: string[]
  count?: number
}

/** Home and Delivery show how many orders wait there. */
function useTabs(): Tab[] {
  const fresh = useOrders('new', '')
  const ready = useOrders('ready', '')
  return [
    { to: '/', label: 'Home', Icon: House, alsoActive: ['/orders'], count: fresh.data?.length },
    { to: '/delivery', label: 'Delivery', Icon: Truck, count: ready.data?.length },
    { to: '/analytics', label: 'Analytics', Icon: BarChart3, alsoActive: ['/pending'] },
    { to: '/catalog', label: 'Products', Icon: Package },
    {
      to: '/more',
      label: 'More',
      Icon: Ellipsis,
      alsoActive: ['/settings', '/trash', '/activity'],
    },
  ]
}

export function TabBar() {
  const { pathname } = useLocation()
  const tabs = useTabs()
  const isActive = (t: Tab) =>
    (t.to === '/' ? pathname === '/' : pathname.startsWith(t.to)) ||
    (t.alsoActive ?? []).some((p) => pathname.startsWith(p))

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-2xl">
        {tabs.map((t) => {
          const active = isActive(t)
          return (
            <li key={t.to} className="min-w-0 flex-1">
              <NavLink
                to={t.to}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${active ? 'text-text' : 'text-muted'}`}
              >
                {/* Active tab: a cream pill behind the icon (docs/DESIGN.md category-tab-active). */}
                <span
                  className={`relative flex h-7 w-12 items-center justify-center rounded-full ${active ? 'bg-surface-strong' : ''}`}
                >
                  <t.Icon className="h-5 w-5" />
                  {t.count ? (
                    <span
                      className="absolute -top-1 right-0.5 min-w-5 rounded-full bg-coral px-1 text-center text-[11px] leading-5 font-semibold text-text tabular-nums"
                      aria-label={`${t.count} waiting`}
                    >
                      {t.count > 99 ? '99+' : t.count}
                    </span>
                  ) : null}
                </span>
                <span className="truncate">{t.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
