import { formatPhone, pluralize } from '../../../lib/format'
import { addMoney, formatINR } from '../../../lib/money'
import type { BillSource } from '../schemas'
import { BILL_FONT } from './billFonts'

export const BILL_WIDTH = 540

export interface BillData {
  source: BillSource
  billNo: string
  /** "10 Oct 2026": the day the bill is made. */
  date: string
  shop: {
    name: string
    address: string
    phone: string
    footer: string | null
    upiId: string | null
  }
  /** data: URLs (never remote URLs, so the canvas is not tainted). */
  logo: string | null
  qr: string | null
}

const muted = 'text-[#6a6a6a]'
const line = 'border-[#e5e5e5]'

/**
 * The bill image, styled per docs/DESIGN.md (cream card, teal total): payment QR on top, details and amount below.
 * Fixed width and fixed light colours (never theme tokens); rendered off-screen at 2x.
 */
export function BillTemplate({ data }: { data: BillData }) {
  const { source: o, shop } = data
  const subtotal = addMoney(...o.items.map((i) => i.line_total))
  return (
    <div
      style={{ width: BILL_WIDTH, fontFamily: BILL_FONT }}
      className="bg-[#f5f0e0] p-5 text-[15px] leading-snug text-[#0a0a0a] [font-variant-numeric:tabular-nums]"
    >
      <div className="overflow-hidden rounded-[24px] bg-[#fffaf0]">
        <header className="flex items-center gap-3 px-6 pt-6 pb-4">
          {data.logo && (
            <img src={data.logo} alt="" className="h-12 w-12 rounded-xl object-contain" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[20px] font-semibold">{shop.name || 'Bill'}</p>
            {shop.phone && <p className={`text-[13px] ${muted}`}>Ph: {shop.phone}</p>}
          </div>
          <div className="text-right text-[13px]">
            <p className={muted}>Bill</p>
            <p className="text-[15px] font-semibold">{data.billNo}</p>
          </div>
        </header>

        <section className="mx-4 flex flex-col items-center gap-3 rounded-[16px] bg-[#faf5e8] px-5 py-5">
          <p className={`self-stretch text-[13px] ${muted}`}>
            Order <span className="font-semibold text-[#0a0a0a]">#{o.order_no}</span>
            <span className="px-2">|</span>
            Date <span className="font-semibold text-[#0a0a0a]">{data.date}</span>
          </p>
          {data.qr ? (
            // White quiet zone around the code keeps it scannable.
            <div className="rounded-2xl bg-white p-3">
              <img src={data.qr} alt="" className="h-56 w-56 object-contain" />
            </div>
          ) : null}
          <p className="rounded-full bg-[#a4d4c5] px-4 py-1.5 text-[15px] font-semibold text-[#0a0a0a]">
            {data.qr ? 'Scan to pay' : 'Amount due'} <span className="px-1">|</span>{' '}
            {formatINR(o.total)}
          </p>
          {shop.upiId && <p className={`text-[13px] ${muted}`}>UPI: {shop.upiId}</p>}
        </section>

        <section
          className={`mx-6 mt-5 flex justify-between gap-4 border-b border-dashed pb-4 ${line}`}
        >
          <div className="min-w-0">
            <p className={`text-[13px] ${muted}`}>Bill to</p>
            <p className="text-[18px] font-semibold break-words">{o.customer_name}</p>
            {o.customer_phone && (
              <p className={`text-[13px] ${muted}`}>{formatPhone(o.customer_phone)}</p>
            )}
          </div>
          <span className="h-fit shrink-0 rounded-lg bg-[#f5f0e0] px-2.5 py-1 text-[13px] font-medium">
            {pluralize(o.items.length, 'item')}
          </span>
        </section>

        <ul className="px-6 pt-2">
          {o.items.map((i) => (
            <li key={i.id} className={`flex items-baseline gap-3 border-b py-2.5 ${line}`}>
              <span className="min-w-0 flex-1 break-words">
                {i.product_name} · {i.variant_name}
                <span className={`block text-[13px] ${muted}`}>
                  {i.quantity} × {formatINR(i.unit_price)}
                </span>
              </span>
              <span className="font-medium">{formatINR(i.line_total)}</span>
            </li>
          ))}
        </ul>

        <dl className="flex flex-col gap-1 px-6 pt-3 pb-5">
          {o.discount > 0 && (
            <>
              <Row label="Subtotal" value={formatINR(subtotal)} />
              <Row label="Discount" value={`− ${formatINR(o.discount)}`} />
            </>
          )}
          <div className="mt-2 flex items-center justify-between rounded-2xl bg-[#1a3a3a] px-4 py-3 text-white">
            <dt className="text-[15px]">Total amount</dt>
            <dd className="text-[22px] font-semibold">{formatINR(o.total)}</dd>
          </div>
        </dl>

        {(shop.address || shop.footer) && (
          <footer className={`border-t px-6 py-4 text-center text-[13px] ${line} ${muted}`}>
            {shop.address && <p className="whitespace-pre-line">{shop.address}</p>}
            {shop.footer && <p className="mt-1 whitespace-pre-line">{shop.footer}</p>}
          </footer>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className={muted}>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
