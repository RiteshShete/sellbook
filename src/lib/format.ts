import { normalizePhone } from './phone'

/** "919876543210" -> "+91 98765 43210"; returns the input unchanged if not a valid number. */
export function formatPhone(input: string): string {
  const n = normalizePhone(input)
  return n ? `+91 ${n.slice(2, 7)} ${n.slice(7)}` : input
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}
