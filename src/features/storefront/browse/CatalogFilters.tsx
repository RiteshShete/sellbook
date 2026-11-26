import { Search } from 'lucide-react'
import { t } from '../i18n'
import type { StoreCatalog } from '../types'

interface Props {
  catalog: StoreCatalog
  query: string
  category: string
  onQuery: (q: string) => void
  onCategory: (c: string) => void
}

/** Search and category chips ("pressed" state is announced, as on the owner's Products screen). */
export function CatalogFilters({ catalog, query, category, onQuery, onCategory }: Props) {
  const known = new Set(catalog.categories.map((c) => c.id))
  const hasOther = catalog.products.some((p) => p.category_id === null || !known.has(p.category_id))
  const chips = [
    { id: 'all', label: t('catalog.all') },
    ...catalog.categories.map((c) => ({ id: c.id, label: c.name })),
    ...(hasOther && catalog.categories.length > 0 ? [{ id: 'none', label: t('catalog.other') }] : []),
  ]
  return (
    <div className="flex flex-col gap-3 px-4">
      <label className="relative block">
        <span className="sr-only">{t('catalog.search')}</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t('catalog.search')}
          className="min-h-11 w-full rounded-xl border border-border-strong bg-surface pl-10 pr-4 outline-none focus:border-text focus:ring-1 focus:ring-text"
        />
      </label>
      {chips.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t('catalog.categories')}>
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={category === c.id}
              onClick={() => onCategory(c.id)}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium ${category === c.id ? 'border-text bg-text text-surface' : 'border-border-strong bg-surface'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
