import type { Category, Product } from './schemas'

/** One block on the Products / New order grid: a category (or null = Uncategorised) and its products. */
export interface ProductSection {
  category: Category | null
  products: Product[]
}

/**
 * Groups products by category, in the owner's category order, with "Uncategorised" last.
 * A product whose category is missing (trashed, or the migration is not applied) is Uncategorised.
 * Empty sections are left out.
 */
export function groupByCategory(products: Product[], categories: Category[]): ProductSection[] {
  const known = new Set(categories.map((c) => c.id))
  const sections = [...categories]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((category) => ({
      category: category as Category | null,
      products: products.filter((p) => p.category_id === category.id),
    }))
  sections.push({
    category: null,
    products: products.filter((p) => p.category_id === null || !known.has(p.category_id)),
  })
  return sections.filter((s) => s.products.length > 0)
}

/** Lower-cases and composes Unicode so "कण्हेरी" typed or pasted either way matches; Latin ignores case. */
export function normalizeSearch(text: string): string {
  return text.normalize('NFC').toLocaleLowerCase('mr').trim()
}

/** Category chip filter: 'all', 'none' (Uncategorised) or a category id. */
export type CategoryFilter = 'all' | 'none' | (string & {})

/** Products matching the search text (name or any variant name) and the category chip. */
export function filterProducts(
  products: Product[],
  categories: Category[],
  query: string,
  filter: CategoryFilter,
): Product[] {
  const q = normalizeSearch(query)
  const known = new Set(categories.map((c) => c.id))
  return products.filter((p) => {
    if (filter === 'none' && p.category_id !== null && known.has(p.category_id)) return false
    if (filter !== 'all' && filter !== 'none' && p.category_id !== filter) return false
    if (q === '') return true
    return [p.name, ...p.variants.map((v) => v.name)].some((t) => normalizeSearch(t).includes(q))
  })
}

/** New order of `ids` after moving `id` one step up (-1) or down (+1); unchanged at the ends. */
export function moveId(ids: string[], id: string, by: -1 | 1): string[] {
  const i = ids.indexOf(id)
  const j = i + by
  const a = ids[i]
  const b = ids[j]
  if (a === undefined || b === undefined) return ids
  return ids.with(i, b).with(j, a)
}
