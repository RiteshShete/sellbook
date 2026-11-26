import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input, Switch } from '../../../components/ui'
import { normalizePhone, toNationalPhone } from '../../../lib/phone'
import { useUpdateShop } from '../hooks/useShop'
import type { Shop } from '../schemas'
import { ShopLogo } from './ShopLogo'

export function ShopProfileForm({ shop }: { shop: Shop }) {
  const [tagline, setTagline] = useState(shop.tagline ?? '')
  const [city, setCity] = useState(shop.city ?? '')
  const [fssai, setFssai] = useState(shop.fssai_no ?? '')
  const [whatsapp, setWhatsapp] = useState(shop.whatsapp ? toNationalPhone(shop.whatsapp) : '')
  const [payUpi, setPayUpi] = useState(shop.pay_upi)
  const [payCod, setPayCod] = useState(shop.pay_cod)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useUpdateShop('Saved')

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const found: Record<string, string> = {}
    const phone = whatsapp.trim() === '' ? null : normalizePhone(whatsapp)
    if (whatsapp.trim() !== '' && phone === null) found.whatsapp = 'Enter a valid 10-digit mobile number'
    if (!payUpi && !payCod) found.pay = 'Keep at least one way to pay switched on'
    setErrors(found)
    if (Object.keys(found).length > 0) return
    save.mutate({ tagline, city, fssai_no: fssai, whatsapp: phone, pay_upi: payUpi, pay_cod: payCod })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <h2 className="font-display text-xl">Shop page</h2>
      <ShopLogo path={shop.logo_path} />
      <Input label="One line about your shop" value={tagline} maxLength={120} onChange={(e) => setTagline(e.target.value)} />
      <Input label="City" value={city} maxLength={80} onChange={(e) => setCity(e.target.value)} />
      <Input label="FSSAI licence number (optional)" value={fssai} maxLength={20} onChange={(e) => setFssai(e.target.value)} />
      <Input
        label="WhatsApp number customers can message"
        type="tel"
        inputMode="tel"
        value={whatsapp}
        onChange={(e) => setWhatsapp(e.target.value)}
        error={errors.whatsapp}
      />
      <Switch label="Customers can pay by UPI" checked={payUpi} onChange={setPayUpi} />
      <Switch label="Customers can pay on delivery or pickup" checked={payCod} onChange={setPayCod} />
      {errors.pay && <p className="text-sm text-danger">{errors.pay}</p>}
      <p className="text-sm text-muted">
        Your shop name, UPI ID and payee name are in{' '}
        <Link to="/settings" className="font-medium underline underline-offset-4">
          Settings
        </Link>
        . Customers see your UPI ID when they place an order.
      </p>
      <Button type="submit" block disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save'}
      </Button>
    </form>
  )
}
