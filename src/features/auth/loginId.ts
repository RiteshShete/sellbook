import { z } from 'zod'
import { toAuthPhone } from '../../lib/phone'

/** Who is signing in: an email address, or an Indian mobile number in the "+91..." form Supabase Auth stores. */
export type LoginId = { kind: 'email'; email: string } | { kind: 'phone'; phone: string }

const Email = z.string().email()

/** Email or mobile number, as typed. null when it is neither (the form shows a message). */
export function parseLoginId(input: string): LoginId | null {
  const text = input.trim()
  if (text === '') return null
  if (text.includes('@')) {
    const parsed = Email.safeParse(text)
    return parsed.success ? { kind: 'email', email: parsed.data.toLowerCase() } : null
  }
  const phone = toAuthPhone(text)
  return phone ? { kind: 'phone', phone } : null
}

/** The credential object supabase-js takes, for either kind. */
export function credentialsFor(id: LoginId): { email: string } | { phone: string } {
  return id.kind === 'email' ? { email: id.email } : { phone: id.phone }
}
