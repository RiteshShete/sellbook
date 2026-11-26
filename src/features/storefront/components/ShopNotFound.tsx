import { t } from '../i18n'

/** Shown for an unknown, unpublished or reserved address. It says nothing else, so it reveals nothing. */
export function ShopNotFound() {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-sm flex-col justify-center gap-3 px-6 py-8">
      <h1 className="font-display text-3xl">{t('shop.notFound.title')}</h1>
      <p className="text-muted">{t('shop.notFound.body')}</p>
    </main>
  )
}
