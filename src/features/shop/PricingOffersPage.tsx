import { useState } from 'react'
import { Page } from '../../app/Page'
import { ErrorState, Skeleton } from '../../components/ui'
import { Calculator } from './components/Calculator'
import { DeliveryForm } from './components/DeliveryForm'
import { OfferList } from './components/OfferList'
import { useOfferVariants, useShop } from './hooks/useShop'
import { shopRules } from './schemas'

/** /pricing: offers per item, the delivery and order rules, and a "what customers pay" preview. */
export function PricingOffersPage() {
  const shop = useShop()
  const variants = useOfferVariants()
  // The calculator follows the rules as they were last saved, updated as soon as a save succeeds.
  const [saved, setSaved] = useState<Partial<NonNullable<typeof shop.data>>>({})

  return (
    <Page title="Prices & offers" back="/more">
      <div className="flex flex-col gap-4">
        <OfferList />
        {shop.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : shop.isError ? (
          <ErrorState error={shop.error} onRetry={() => void shop.refetch()} />
        ) : shop.data === null ? (
          <p className="text-muted">Set up your online shop first (More, then Set up your online shop).</p>
        ) : (
          <>
            <DeliveryForm key={shop.dataUpdatedAt} shop={shop.data} onChange={setSaved} />
            {variants.data && <Calculator variants={variants.data} rules={shopRules({ ...shop.data, ...saved })} />}
          </>
        )}
      </div>
    </Page>
  )
}
