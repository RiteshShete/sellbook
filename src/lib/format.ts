import { normalizePhone } from './phone'

/** "919876543210" -> "+91 98765 43210"; returns the input unchanged if not a valid number. */
export function formatPhone(input: string): string {
  const n = normalizePhone(input)
  return n ? `+91 ${n.slice(2, 7)} ${n.slice(7)}` : input
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

const nameCollator = new Intl.Collator('mr', { sensitivity: 'base', numeric: true })

/** Sorts Devanagari (Marathi) and Latin names the way a Marathi reader expects; "10" after "9". */
export function compareNames(a: string, b: string): number {
  return nameCollator.compare(a, b)
}

/** Bytes for people: "512 KB", "20 MB", "1.5 GB". Binary units, like the storage dashboards use. */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = Math.max(0, bytes)
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const text = unit === 0 || value >= 100 ? String(Math.round(value)) : String(Math.round(value * 10) / 10)
  return `${text} ${units[unit]}`
}
