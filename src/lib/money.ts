/**
 * Money is an integer number of paise in JS. Never do float math on rupees.
 * Conversion to/from Postgres numeric(12,2) happens only at the API boundary.
 */
export type Paise = number

function assertInt(value: number, what: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${what} must be a safe integer, got ${value}`)
  }
}

/** Parses a plain decimal string ("1250.5", "-3.005") to paise, rounding half away from zero. */
function decimalStringToPaise(text: string): Paise | null {
  const m = /^([+-])?(\d+)(?:\.(\d*))?$/.exec(text)
  if (!m) return null
  const sign = m[1] === '-' ? -1 : 1
  const whole = m[2] ?? '0'
  const frac = m[3] ?? ''
  const cents = Number(`${whole}${frac.slice(0, 2).padEnd(2, '0')}`)
  const roundUp = (frac[2] ?? '0') >= '5' ? 1 : 0
  const paise = cents + roundUp
  if (!Number.isSafeInteger(paise)) return null
  return sign * paise || 0
}

function numberToPlainString(n: number): string {
  if (!Number.isFinite(n)) return 'NaN'
  const s = String(n)
  return /e/i.test(s) ? n.toFixed(10) : s
}

/** Rupees (number or decimal string) -> integer paise, half-up on the decimal digits (1.005 -> 101). */
export function toPaise(rupees: number | string): Paise {
  const text = typeof rupees === 'number' ? numberToPlainString(rupees) : rupees.trim()
  const paise = decimalStringToPaise(text)
  if (paise === null) throw new RangeError(`Cannot convert "${String(rupees)}" to paise`)
  return paise
}

/** Integer paise -> rupees as a number (display / chart math only, not for sums). */
export function fromPaise(paise: Paise): number {
  assertInt(paise, 'paise')
  return paise / 100
}

/** Integer paise -> exact decimal string for the database, e.g. 125050 -> "1250.50". */
export function paiseToDecimalString(paise: Paise): string {
  assertInt(paise, 'paise')
  const sign = paise < 0 ? '-' : ''
  const abs = Math.abs(paise)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

export function addMoney(...values: Paise[]): Paise {
  return values.reduce((sum, v) => {
    assertInt(v, 'amount')
    return sum + v
  }, 0)
}

/** Unit price (paise) x whole quantity. */
export function multiplyMoney(unit: Paise, quantity: number): Paise {
  assertInt(unit, 'unit price')
  assertInt(quantity, 'quantity')
  return unit * quantity
}

const inrWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})
const inrFull = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** 125050 -> "₹1,250.50", 100000 -> "₹1,000", 12500000 -> "₹1,25,000". */
export function formatINR(paise: Paise): string {
  assertInt(paise, 'paise')
  return (paise % 100 === 0 ? inrWhole : inrFull).format(paise / 100)
}

/**
 * Safe parse of typed money like "1,250.5", "₹ 99", "Rs. 40". Returns paise, or null if
 * empty/invalid/negative. More than 2 decimals is rounded half-up.
 */
export function parseMoneyInput(input: string): Paise | null {
  const cleaned = input.replace(/₹|rs\.?|inr/gi, '').replace(/[,\s]/g, '')
  if (!/\d/.test(cleaned) || cleaned.startsWith('-') || cleaned.startsWith('+')) return null
  const text = cleaned.startsWith('.') ? `0${cleaned}` : cleaned
  return decimalStringToPaise(text)
}
