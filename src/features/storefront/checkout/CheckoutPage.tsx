import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Button, ErrorState, Input, Skeleton, Textarea } from '../../../components/ui'
import { useAuth } from '../../auth/useAuth'
import { useMyContext } from '../../auth/myContext'
import { CartTotals } from '../cart/CartTotals'
import { estimateTotals, priceCart } from '../cart/priceCart'
import { useCart } from '../cart/useCart'
import { ShopNotFound } from '../components/ShopNotFound'
import { fetchCustomerProfile } from '../customerApi'
import { useAddresses, useStoreCatalog, useStoreShop } from '../hooks/useStore'
import { t } from '../i18n'
import { storefrontPath } from '../paths'
import { AddressForm } from './AddressForm'
import { AddressPicker } from './AddressPicker'
import { dateRange, fulfilmentOptions, hasErrors, paymentOptions, validateCheckout, type AddressInput, type CheckoutErrors } from './validate'
import { usePlaceOrder } from './usePlaceOrder'

const blank: AddressInput = { name: '', phone: '', line1: '', line2: '', area: '', city: '', pincode: '', landmark: '' }

/** /<shop>/checkout: sign in, how, where, when, how to pay, review, place the order (once). */
export function CheckoutPage() {
  const { slug = '' } = useParams()
  const { status, client } = useAuth()
  const ctx = useMyContext()
  const shop = useStoreShop(slug)
  const catalog = useStoreCatalog(slug)
  const saved = useAddresses()
  const profile = useQuery({ queryKey: ['customerProfile'], queryFn: () => fetchCustomerProfile(client), enabled: status === 'signedIn' })
  const { cart } = useCart(slug)
  const place = usePlaceOrder(slug)

  const [fulfilment, setFulfilment] = useState<'delivery' | 'pickup' | null>(null)
  const [addressChoice, setAddressChoice] = useState<string | null | undefined>(undefined)
  const [typed, setTyped] = useState<Partial<AddressInput>>({})
  const [remember, setRemember] = useState(false)
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [method, setMethod] = useState<'upi' | 'cod' | null>(null)
  const [errors, setErrors] = useState<CheckoutErrors>({})

  const back = { from: storefrontPath(slug, 'checkout') }
  if (status === 'signedOut') return <Navigate to={storefrontPath(slug, 'login')} replace state={back} />
  if (status === 'loading' || shop.isPending || catalog.isPending || ctx.isPending || saved.isPending || profile.isPending) return <Skeleton className="m-4 h-72" />
  if (ctx.data && !ctx.data.has_customer_profile && !ctx.data.is_owner) return <Navigate to={storefrontPath(slug, 'signup')} replace state={back} />
  if (shop.isError || catalog.isError) return <div className="p-4"><ErrorState error={shop.error ?? catalog.error} onRetry={() => void Promise.all([shop.refetch(), catalog.refetch()])} /></div>
  if (!shop.data || !catalog.data) return <ShopNotFound />
  if (cart.lines.length === 0) return <Navigate to={storefrontPath(slug, 'cart')} replace />

  const fulfilments = fulfilmentOptions(shop.data)
  const payments = paymentOptions(shop.data)
  const chosenFulfilment = fulfilment ?? fulfilments[0] ?? 'delivery'
  const chosenMethod = method ?? payments[0] ?? 'cod'
  const chosenDate = date || shop.data.earliest_date
  const savedList = saved.data ?? []
  const addressId = addressChoice === undefined ? (savedList[0]?.id ?? null) : addressChoice
  const address: AddressInput = { ...blank, name: profile.data?.name ?? '', phone: profile.data?.phone ? profile.data.phone.slice(-10) : '', ...typed }
  const lines = priceCart(cart, catalog.data)
  const totals = estimateTotals(lines, shop.data, chosenFulfilment)
  const range = dateRange(shop.data)
  const stuck = !shop.data.accepts_orders || lines.some((l) => l.status === 'unavailable') || totals.belowMinimum

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const input = { fulfilment: chosenFulfilment, addressId, address, requestedFor: chosenDate, notes, method: chosenMethod }
    const found = shop.data ? validateCheckout(input, shop.data) : {}
    setErrors(found)
    if (!hasErrors(found)) place.mutate({ input, remember })
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-4">
      <h1 className="mb-4 font-display text-3xl">{t('checkout.title')}</h1>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {fulfilments.length > 1 && (
          <fieldset className="flex gap-2">
            <legend className="mb-1 text-sm font-medium text-muted">{t('checkout.how')}</legend>
            {fulfilments.map((f) => (
              <label key={f} className={`flex min-h-12 flex-1 cursor-pointer items-center justify-center rounded-xl border px-3 ${chosenFulfilment === f ? 'border-text bg-surface-2' : 'border-border-strong'}`}>
                <input type="radio" name="fulfilment" className="sr-only" checked={chosenFulfilment === f} onChange={() => setFulfilment(f)} />
                {t(f === 'delivery' ? 'checkout.delivery' : 'checkout.pickup')}
              </label>
            ))}
          </fieldset>
        )}
        {chosenFulfilment === 'pickup' && shop.data.pickup_address && <p className="text-sm text-muted">{t('checkout.pickupAt', { address: shop.data.pickup_address })}</p>}
        {chosenFulfilment === 'delivery' && (
          <section className="flex flex-col gap-3">
            {savedList.length > 0 && <AddressPicker saved={savedList} value={addressId} onChange={setAddressChoice} />}
            {addressId === null && (
              <>
                <AddressForm value={address} errors={errors} onChange={(p) => { setTyped((s) => ({ ...s, ...p })); setErrors({}) }} />
                <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="h-5 w-5" checked={remember} onChange={(e) => setRemember(e.target.checked)} />{t('checkout.saveAddress')}</label>
              </>
            )}
          </section>
        )}
        <div className="flex flex-col gap-1">
          <Input label={t('checkout.date')} type="date" min={range.min} max={range.max} value={chosenDate} onChange={(e) => { setDate(e.target.value); setErrors({}) }} error={errors.date} />
          <p className="text-sm text-muted">{t('checkout.earliest', { date: shop.data.earliest_date })}</p>
        </div>
        <Textarea label={t('checkout.notes')} value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} error={errors.notes} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-muted">{t('checkout.payment')}</legend>
          {payments.map((m) => (
            <label key={m} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 ${chosenMethod === m ? 'border-text bg-surface-2' : 'border-border-strong'}`}>
              <input type="radio" name="method" className="h-5 w-5" checked={chosenMethod === m} onChange={() => setMethod(m)} />
              {t(m === 'upi' ? 'checkout.payUpi' : 'checkout.payCod')}
            </label>
          ))}
          {errors.method && <p role="alert" className="text-sm text-danger">{errors.method}</p>}
        </fieldset>
        <section className="rounded-2xl border border-border bg-surface p-4" aria-label={t('checkout.review')}>
          <h2 className="mb-2 font-medium">{t('checkout.review')}</h2>
          <CartTotals totals={totals} />
        </section>
        {stuck && <p role="alert" className="text-sm text-danger-ink">{t('checkout.stuck')}</p>}
        {place.isError && <p role="alert" className="text-sm text-danger-ink">{place.error.message}</p>}
        <Button type="submit" block disabled={place.isPending || stuck}>{place.isPending ? t('checkout.placing') : t('checkout.place')}</Button>
      </form>
    </main>
  )
}
