/** Every TanStack Query key in one place. Mutations invalidate by these prefixes. */
export const queryKeys = {
  settings: ['settings'] as const,
  plan: ['plan'] as const,
  /** Who the signed-in person is: owner of a shop, customer, or both (my_context). */
  myContext: ['myContext'] as const,
  /** The customer storefront (public shop, catalogue, a customer's orders and saved addresses). */
  store: {
    shop: (slug: string) => ['store', 'shop', slug] as const,
    catalog: (slug: string) => ['store', 'catalog', slug] as const,
    orders: (slug: string) => ['store', 'orders', slug] as const,
    order: (id: string) => ['store', 'order', id] as const,
    addresses: ['store', 'addresses'] as const,
  },
  /** The shop's own online-shop settings (shops row) and its variants' offers. */
  shop: ['shop'] as const,
  offers: ['offers'] as const,
  /** The auth user (email verified or not), for the recovery-email prompt. */
  authUser: ['authUser'] as const,
  planLimits: ['planLimits'] as const,
  admin: {
    all: ['admin'] as const,
    isAdmin: ['admin', 'is'] as const,
    stats: ['admin', 'stats'] as const,
    requests: (status: string) => ['admin', 'requests', status] as const,
    shops: (query: string) => ['admin', 'shops', query] as const,
  },
  asset: (path: string) => ['asset', path] as const,
  /** A UPI QR image is a pure function of its link, so it is cached by link. */
  upiQr: (uri: string) => ['upiQr', uri] as const,
  orders: {
    all: ['orders'] as const,
    list: (tab: string, search: string) => ['orders', 'list', tab, search] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
    versions: (id: string) => ['orders', 'versions', id] as const,
    // Under 'orders' so every order change also refreshes the bill's outdated check (B7).
    bills: (id: string) => ['orders', 'bills', id] as const,
    // Under 'orders' so creating, editing or moving any order refreshes the prep list.
    prep: ['orders', 'prep'] as const,
    // Customer orders waiting for the shop (confirm, verify payment, refund reminder). Under 'orders': any order change refreshes it.
    needs: ['orders', 'needs'] as const,
    utr: (reference: string) => ['orders', 'utr', reference] as const,
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
    feed: (entity: string, entityId: string | null) =>
      ['activity', 'feed', entity, entityId] as const,
    entities: (kind: string, search: string) => ['activity', 'entities', kind, search] as const,
    entity: (kind: string, id: string) => ['activity', 'entity', kind, id] as const,
  },
  analytics: {
    all: ['analytics'] as const,
    month: (month: string, source = 'all') => ['analytics', 'month', month, source] as const,
  },
  pending: ['pending'] as const,
  categories: ['categories'] as const,
  importBatches: ['importBatches'] as const,
  products: {
    all: ['products'] as const,
    list: () => ['products', 'list'] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
    /** Online details and pictures of one product (under 'products', so catalog changes refresh it too). */
    online: (id: string) => ['products', 'online', id] as const,
  },
}
