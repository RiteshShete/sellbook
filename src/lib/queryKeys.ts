/** Every TanStack Query key in one place. Mutations invalidate by these prefixes. */
export const queryKeys = {
  settings: ['settings'] as const,
  asset: (path: string) => ['asset', path] as const,
  orders: {
    all: ['orders'] as const,
    list: (tab: string, search: string) => ['orders', 'list', tab, search] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
    versions: (id: string) => ['orders', 'versions', id] as const,
  },
  customers: (q: string) => ['customers', q] as const,
  trash: {
    all: ['trash'] as const,
    tab: (tab: string) => ['trash', tab] as const,
  },
  activity: (entity: string) => ['activity', entity] as const,
  products: {
    all: ['products'] as const,
    list: () => ['products', 'list'] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
  },
}
