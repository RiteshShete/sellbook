import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { Page } from '../../app/Page'
import { upiQrDataUrl } from '../../lib/qrImage'
import { Button, ErrorState, Skeleton } from '../../components/ui'
import { useSettings } from '../settings/hooks/useSettings'
import { shopLink } from './components/ShareCard'
import { useShop } from './hooks/useShop'

/** A QR code of the shop link, big and printable: stick it on the counter or the door. */
export function ShopPosterPage() {
  const shop = useShop()
  const name = useSettings().data?.shop_name || 'Our shop'
  const link = shop.data ? shopLink(shop.data.slug) : ''
  // The same black-on-white QR maker the bill uses; it works for any link.
  const qr = useQuery({ queryKey: ['shopPosterQr', link], queryFn: () => upiQrDataUrl(link), enabled: link !== '' })

  return (
    <Page title="QR poster" back="/more/shop">
      {shop.isPending || qr.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : shop.isError || qr.isError ? (
        <ErrorState error={shop.error ?? qr.error} onRetry={() => void (shop.isError ? shop.refetch() : qr.refetch())} />
      ) : (
        <div className="flex flex-col gap-4">
          <section className="flex flex-col items-center gap-3 rounded-2xl border border-border-strong bg-white p-6 text-center print:border-0">
            <h2 className="font-display text-3xl">{name}</h2>
            <img src={qr.data} alt={`QR code for ${link}`} width={288} height={288} className="h-72 w-72" />
            <p className="text-xl font-medium">Scan to order</p>
            <p className="break-all text-sm text-muted">{link}</p>
          </section>
          {!shop.data?.is_published && <p className="text-sm text-muted print:hidden">The link works for customers once you publish your shop.</p>}
          <Button className="print:hidden" onClick={() => window.print()}>
            <Printer className="h-5 w-5" /> Print
          </Button>
        </div>
      )}
    </Page>
  )
}
