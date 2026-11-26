import { Link } from 'react-router-dom'
import { Page } from '../../app/Page'
import { ErrorState, Skeleton } from '../../components/ui'
import { PublishPanel } from './components/PublishPanel'
import { ShareCard } from './components/ShareCard'
import { ShopProfileForm } from './components/ShopProfileForm'
import { useShop } from './hooks/useShop'

/** /more/shop: how the shop looks to customers, whether it is live, and its link. */
export function ShopProfilePage() {
  const shop = useShop()
  return (
    <Page title="Online shop" back="/more">
      {shop.isPending ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Loading">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : shop.isError ? (
        <ErrorState error={shop.error} onRetry={() => void shop.refetch()} />
      ) : shop.data === null ? (
        <div className="flex flex-col gap-3">
          <p>You have not set up your online shop yet. You need an invite code.</p>
          <Link to="/create-shop" className="font-medium underline underline-offset-4">
            Set up your online shop
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <PublishPanel shop={shop.data} />
          <ShareCard shop={shop.data} />
          {/* key: a fresh form after every save, so it always shows what the server holds */}
          <ShopProfileForm key={shop.dataUpdatedAt} shop={shop.data} />
          <Link to="/pricing" className="min-h-11 font-medium underline underline-offset-4">
            Prices, offers and delivery
          </Link>
        </div>
      )}
    </Page>
  )
}
