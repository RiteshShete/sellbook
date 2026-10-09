/** Every TanStack Query key in one place. Mutations invalidate by these prefixes. */
export const queryKeys = {
  settings: ['settings'] as const,
  asset: (path: string) => ['asset', path] as const,
  orders: {
    all: ['orders'] as const,
    list: (tab: string, search: string) => ['orders', 'list', tab, search] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
    versions: (id: string) => ['orders', 'versions', id] as const,
    // Under 'orders' so every order change also refreshes the bill's outdated check (B7).
    bills: (id: string) => ['orders', 'bills', id] as const,
    // Under 'orders' so creating, editing or moving any order refreshes the prep list.
    prep: ['orders', 'prep'] as const,
  },
  /** Bill PNGs are immutable per path, so they are cached forever. */
  billImage: (path: string) => ['billImage', path] as const,
  customers: {
    all: ['customers'] as const,
    search: (q: string) => ['customers', q] as const,
  },
  trash: {
    all: ['trash'] as const,
    tab: (tab: string) => ['trash', tab] as const,
  },
  activity: {
    all: ['activity'] as const,
    list: (entity: string) => ['activity', entity] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    month: (month: string) => ['analytics', 'month', month] as const,
  },
  pending: ['pending'] as const,
  products: {
    all: ['products'] as const,
    list: () => ['products', 'list'] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
  },
}
