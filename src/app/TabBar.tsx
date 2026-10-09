import { BarChart3, Ellipsis, Package, ClipboardList, Truck } from 'lucide-react'
import type { ComponentType } from 'react'
import { NavLink } from 'react-router-dom'

const TABS: { to: string; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { to: '/orders', label: 'Orders', Icon: ClipboardList },
  { to: '/delivery', label: 'Delivery', Icon: Truck },
  { to: '/analytics', label: 'Analytics', Icon: BarChart3 },
  { to: '/catalog', label: 'Catalog', Icon: Package },
  { to: '/more', label: 'More', Icon: Ellipsis },
]

export function TabBar() {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map(({ to, label, Icon }) => (
          <li key={to} className="min-w-0 flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                `group flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${isActive ? 'text-text' : 'text-muted'}`
              }
            >
              {/* Active tab: a cream pill behind the icon (docs/DESIGN.md category-tab-active). */}
              <span className="flex h-7 w-12 items-center justify-center rounded-full group-aria-[current=page]:bg-surface-strong">
                <Icon className="h-5 w-5" />
              </span>
              <span className="truncate">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
