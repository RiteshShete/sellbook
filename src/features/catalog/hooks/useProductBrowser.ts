import { useMemo, useState } from 'react'
import { filterProducts, groupByCategory, type CategoryFilter } from '../categories'
import type { Category, Product } from '../schemas'
import { useCategories, useProducts } from './useCatalog'

const NO_CATEGORIES: Category[] = []

/**
 * Products + categories + the search / chip state shared by Products and New order.
 * `sections` is the filtered list grouped by category; `categories` stays empty until the owner
 * creates some (or while the migration is not applied). `keep` must be a stable function.
 */
export function useProductBrowser(keep: (p: Product) => boolean = () => true) {
  const products = useProducts()
  const cats = useCategories()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<CategoryFilter>('all')

  const categories = cats.data?.categories ?? NO_CATEGORIES
  const all = useMemo(() => (products.data ?? []).filter(keep), [products.data, keep])
  const sections = useMemo(
    () => groupByCategory(filterProducts(all, categories, query, filter), categories),
    [all, categories, query, filter],
  )
  const known = new Set(categories.map((c) => c.id))
  return {
    products,
    categories,
    categoriesAvailable: cats.data?.available ?? false,
    all,
    sections,
    query,
    setQuery,
    filter,
    setFilter,
    showUncategorised:
      categories.length > 0 && all.some((p) => p.category_id === null || !known.has(p.category_id)),
    isFiltering: query.trim() !== '' || filter !== 'all',
  }
}
