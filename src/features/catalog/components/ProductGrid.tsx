import { Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { Chip } from '../../../components/ui'
import type { CategoryFilter, ProductSection } from '../categories'
import type { Category } from '../schemas'

/** 2 columns at 360 px, 3 from the `sm` breakpoint. No horizontal scrolling. */
export function ProductGrid({ children }: { children: ReactNode }) {
  return <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</ul>
}

export interface ProductFiltersProps {
  query: string
  onQuery: (q: string) => void
  filter: CategoryFilter
  onFilter: (f: CategoryFilter) => void
  categories: Category[]
  /** Show the "Uncategorised" chip (only useful when some product has no category). */
  showUncategorised: boolean
}

/** Search box + category chips above the grid. Chips only appear once categories exist. */
export function ProductFilters({
  query,
  onQuery,
  filter,
  onFilter,
  categories,
  showUncategorised,
}: ProductFiltersProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="relative block">
        <span className="sr-only">Search products</span>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search products"
          className="min-h-11 w-full rounded-xl border border-border-strong bg-surface pr-4 pl-10 text-text outline-none focus:border-text focus:ring-1 focus:ring-text"
        />
      </label>
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
          <Chip selected={filter === 'all'} onClick={() => onFilter('all')}>
            All
          </Chip>
          {categories.map((c) => (
            <Chip key={c.id} selected={filter === c.id} onClick={() => onFilter(c.id)}>
              {c.name}
            </Chip>
          ))}
          {showUncategorised && (
            <Chip selected={filter === 'none'} onClick={() => onFilter('none')}>
              Uncategorised
            </Chip>
          )}
        </div>
      )}
    </div>
  )
}

/** Section heading for a grouped grid ("Flours", or "Uncategorised" when category is null). */
export function sectionTitle(s: ProductSection): string {
  return s.category?.name ?? 'Uncategorised'
}
