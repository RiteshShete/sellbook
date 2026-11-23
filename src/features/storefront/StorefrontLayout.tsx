import { ShoppingBag, User } from 'lucide-react'
import { Suspense, useEffect, type ReactNode } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import { RESERVED_SLUGS } from '../../lib/slug'
import { Skeleton } from '../../components/ui'
import { rememberShop } from '../auth/lastShop'
import { cartCount } from './cart/cartStore'
import { useCart } from './cart/useCart'
import { ShopNotFound } from './components/ShopNotFound'
import { useStoreShop } from './hooks/useStore'
import { t } from './i18n'
import { storefrontPath } from './paths'

/** Keeps search engines away from pages that are personal (login, account, cart...). */
export function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])
}

/** The page every storefront account screen sits in: a narrow centred column. */
export function StoreShell({ title, children }: { title: string; children: ReactNode }) {
  const { slug = '' } = useParams()
  useNoIndex()
  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-sm flex-col justify-center gap-5 px-6 py-8">
      <h1 className="font-display text-3xl">{title}</h1>
      {children}
      <Link to={storefrontPath(slug)} className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">
        {t('shop.back')}
      </Link>
    </main>
  )
}

function StoreHeader({ slug }: { slug: string }) {
  const shop = useStoreShop(slug)
  const { cart } = useCart(slug)
  const count = cartCount(cart)
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex min-h-14 max-w-2xl items-center justify-between gap-2 px-4">
        <Link to={storefrontPath(slug)} className="min-w-0 truncate font-display text-xl">
          {shop.data?.name || slug}
        </Link>
        <nav className="flex items-center" aria-label="Shop">
          <Link to={storefrontPath(slug, 'cart')} className="relative grid h-11 w-11 place-items-center" aria-label={`${t('cart.view')}${count > 0 ? `, ${t('cart.items', { n: count })}` : ''}`}>
            <ShoppingBag className="h-6 w-6" aria-hidden />
            {count > 0 && <span className="absolute right-0 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-xs text-primary-fg">{count}</span>}
          </Link>
          <Link to={storefrontPath(slug, 'account')} className="grid h-11 w-11 place-items-center" aria-label={t('account.title')}>
            <User className="h-6 w-6" aria-hidden />
          </Link>
        </nav>
      </div>
    </header>
  )
}

export function StorefrontLayout() {
  const { slug = '' } = useParams()
  const reserved = RESERVED_SLUGS.includes(slug)
  useEffect(() => {
    if (slug && !reserved) rememberShop(slug)
  }, [slug, reserved])
  // A reserved word (login, admin, ...) is never a shop: say so without asking the server anything.
  if (reserved) return <ShopNotFound />
  return (
    <div className="min-h-dvh bg-bg">
      <StoreHeader slug={slug} />
      <Suspense fallback={<Skeleton className="m-4 h-40" />}>
        <Outlet />
      </Suspense>
    </div>
  )
}
