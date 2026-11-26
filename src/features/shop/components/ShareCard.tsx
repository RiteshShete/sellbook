import { Copy, ExternalLink, MessageCircle, QrCode } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button, toast } from '../../../components/ui'
import { useSettings } from '../../settings/hooks/useSettings'
import type { Shop } from '../schemas'

/** The link customers use, built from where the app is served (never hard-coded). */
export const shopLink = (slug: string): string => `${window.location.origin}${import.meta.env.BASE_URL}${slug}/products`

/** Copy the link, send it on WhatsApp, or open it as a customer would. */
export function ShareCard({ shop }: { shop: Shop }) {
  const name = useSettings().data?.shop_name || 'our shop'
  const link = shopLink(shop.slug)
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`Order from ${name} here: ${link}`)}`

  function copy() {
    navigator.clipboard.writeText(link).then(
      () => toast.success('Link copied'),
      () => toast.error('Could not copy. Press and hold the link to copy it.'),
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <h2 className="font-display text-xl">Share your shop</h2>
      <p className="break-all rounded-xl bg-surface-2 px-3 py-2 text-sm" data-testid="shop-link">
        {link}
      </p>
      {!shop.is_published && <p className="text-sm text-muted">The link works for customers once you publish.</p>}
      <div className="grid grid-cols-1 gap-2">
        <Button onClick={copy}>
          <Copy className="h-5 w-5" /> Copy link
        </Button>
        <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-strong px-4 font-medium">
          <MessageCircle className="h-5 w-5" /> Share on WhatsApp
        </a>
        <Link to="/more/shop/poster" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-strong px-4 font-medium">
          <QrCode className="h-5 w-5" /> QR poster to print
        </Link>
        <a href={link} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border-strong px-4 font-medium">
          <ExternalLink className="h-5 w-5" /> Preview as a customer
        </a>
      </div>
      <p className="text-sm text-muted">Link previews in WhatsApp are basic for now.</p>
    </section>
  )
}
