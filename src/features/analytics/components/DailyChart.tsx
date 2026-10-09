import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDate } from '../../../lib/dates'
import { formatINR, fromPaise } from '../../../lib/money'
import type { MonthAnalytics } from '../schemas'

const compactINR = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

interface Point {
  day: string
  date: string
  rupees: number
  paise: number
  orders: number
}

/** Daily sales for the month (delivered orders by IST day), with a tap/hover tooltip. */
export function DailyChart({ daily }: { daily: MonthAnalytics['daily'] }) {
  const data: Point[] = daily.map((d) => ({
    day: String(Number(d.date.slice(8))),
    date: d.date,
    rupees: fromPaise(d.sales), // chart scale only; labels use exact paise
    paise: d.sales,
    orders: d.orders,
  }))
  const busy = data.filter((d) => d.orders > 0)

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="font-semibold">Daily sales</h2>
      <p className="text-sm text-muted">Delivered orders by day</p>
      <div className="mt-3 h-52" role="img" aria-label="Bar chart of daily sales for the month">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
            barCategoryGap={2}
          >
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis
              width={52}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
              tickFormatter={(v: number) => compactINR.format(v)}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              content={({ active, label }) => {
                const p = active ? data.find((d) => d.day === String(label)) : undefined
                return p ? <TipBox point={p} /> : null
              }}
            />
            <Bar dataKey="rupees" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium underline underline-offset-4">
          Show as table
        </summary>
        {busy.length === 0 ? (
          <p className="py-2 text-sm text-muted">No deliveries this month.</p>
        ) : (
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-1 font-medium">Day</th>
                <th className="py-1 text-right font-medium">Orders</th>
                <th className="py-1 text-right font-medium">Sales</th>
              </tr>
            </thead>
            <tbody>
              {busy.map((d) => (
                <tr key={d.date} className="border-t border-border">
                  <td className="py-1.5">{formatDate(d.date)}</td>
                  <td className="py-1.5 text-right">{d.orders}</td>
                  <td className="py-1.5 text-right">{formatINR(d.paise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </details>
    </section>
  )
}

function TipBox({ point }: { point: Point }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-sm shadow-md">
      <p className="text-muted">{formatDate(point.date)}</p>
      <p className="font-semibold tabular-nums">{formatINR(point.paise)}</p>
      <p className="text-muted">
        {point.orders} {point.orders === 1 ? 'order' : 'orders'}
      </p>
    </div>
  )
}
