import { useEffect, type ReactNode } from 'react'
import { Link, Outlet, useParams } from 'react-router-dom'
import { rememberShop } from '../auth/lastShop'
import { storefrontPath } from './paths'
import { t } from './i18n'

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

/** The page every storefront account screen sits in: the shop link on top, a narrow centred column below. */
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

export function StorefrontLayout() {
  const { slug = '' } = useParams()
  useEffect(() => {
    if (slug) rememberShop(slug)
  }, [slug])
  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-surface pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-14 max-w-2xl items-center px-4">
          <Link to={storefrontPath(slug)} className="min-w-0 truncate font-display text-xl">
            {slug}
          </Link>
        </div>
      </header>
      <Outlet />
    </div>
  )
}
