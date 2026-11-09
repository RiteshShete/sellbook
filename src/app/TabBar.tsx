import { ChartBar, House, Package, TruckTrailer, User, type Icon } from '@phosphor-icons/react'
import { NavLink, useLocation } from 'react-router-dom'
import { useOrders } from '../features/orders/hooks/useOrders'

interface Tab {
  to: string
  label: string
  Icon: Icon
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
    { to: '/delivery', label: 'Delivery', Icon: TruckTrailer, count: ready.data?.length },
    { to: '/analytics', label: 'Analytics', Icon: ChartBar, alsoActive: ['/pending'] },
    { to: '/catalog', label: 'Products', Icon: Package },
    {
      to: '/more',
      label: 'Profile',
      Icon: User,
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
      <ul className="mx-auto flex max-w-2xl lg:max-w-[75vw]">
        {tabs.map((t) => {
          const active = isActive(t)
          return (
            <li key={t.to} className="min-w-0 flex-1">
              <NavLink
                to={t.to}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${active ? 'text-text' : 'text-muted'}`}
              >
                {/* Active tab: the filled icon in ink; inactive: the regular outline in muted. */}
                <span className="relative flex h-5 w-5 items-center justify-center">
                  <t.Icon size={20} weight={active ? 'fill' : 'regular'} aria-hidden />
                  {t.count ? (
                    <span
                      className="absolute top-[-3px] left-1/2 flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[11px] leading-none font-semibold text-text tabular-nums"
                      aria-label={`${t.count} waiting`}
                    >
                      {t.count > 99 ? '99+' : t.count}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate px-1 leading-5">{t.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
