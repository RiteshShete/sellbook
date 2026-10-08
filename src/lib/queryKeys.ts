/** Every TanStack Query key in one place. Mutations invalidate by these prefixes. */
export const queryKeys = {
  settings: ['settings'] as const,
  asset: (path: string) => ['asset', path] as const,
  products: {
    all: ['products'] as const,
    list: () => ['products', 'list'] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
  },
}
