import type { SupabaseClient } from '@supabase/supabase-js'
import { TERMS_VERSION } from '../legal/terms'
import { credentialsFor, type LoginId } from './loginId'
import { readableAuthError } from './schemas'

/** An address inside this app (works under /sellbook/ too); emailed links come back to it. */
const appUrl = (path = '') => new URL(import.meta.env.BASE_URL + path, window.location.origin).toString()

/** Every failure becomes an Error with a message the person can act on (shown as a toast or under the field). */
function check(error: { message: string; code?: string } | null): void {
  if (error) throw new Error(readableAuthError(error.message, error.code))
}

const captcha = (token?: string) => (token ? { captchaToken: token } : {})

/** Email or mobile + password. */
export async function signInWithId(client: SupabaseClient, id: LoginId, password: string): Promise<void> {
  const { error } = await client.auth.signInWithPassword({ ...credentialsFor(id), password })
  check(error)
}

/**
 * Creates the account. A mobile number is signed in at once (no SMS is sent, so the number is NOT verified);
 * an email gets a confirmation link first. Returns whether a session already exists.
 */
export async function signUpWithId(
  client: SupabaseClient,
  id: LoginId,
  password: string,
  captchaToken?: string,
): Promise<{ signedIn: boolean }> {
  const { data, error } = await client.auth.signUp({
    ...credentialsFor(id),
    password,
    options: { ...captcha(captchaToken), emailRedirectTo: appUrl(), data: { terms_version: TERMS_VERSION } },
  })
  check(error)
  return { signedIn: Boolean(data.session) }
}

/** Sends a 6-digit code to the email (if the account exists; the answer is the same either way). */
export async function sendRecoveryCode(client: SupabaseClient, email: string, captchaToken?: string): Promise<void> {
  const { error } = await client.auth.resetPasswordForEmail(email, captcha(captchaToken))
  check(error)
}

/** Checks the emailed code, then sets the new password (the code signs the person in). */
export async function resetPasswordWithCode(
  client: SupabaseClient,
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  const verified = await client.auth.verifyOtp({ email, token: code, type: 'recovery' })
  check(verified.error)
  const { error } = await client.auth.updateUser({ password: newPassword })
  check(error)
}

/** Attaches a recovery email to the signed-in account; Supabase emails a 6-digit code to it. */
export async function addRecoveryEmail(client: SupabaseClient, email: string): Promise<void> {
  const { error } = await client.auth.updateUser({ email })
  check(error)
}

export async function confirmRecoveryEmail(client: SupabaseClient, email: string, code: string): Promise<void> {
  const { error } = await client.auth.verifyOtp({ email, token: code, type: 'email_change' })
  check(error)
}

/** Asks for the current password first (signing in again proves it), then sets the new one. */
export async function changePassword(
  client: SupabaseClient,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const { data } = await client.auth.getUser()
  const user = data.user
  const who = user?.email ? { email: user.email } : user?.phone ? { phone: `+${user.phone.replace(/^\+/, '')}` } : null
  if (!who) throw new Error('Please sign in again.')
  const again = await client.auth.signInWithPassword({ ...who, password: currentPassword })
  if (again.error) throw new Error('The current password is not right.')
  const { error } = await client.auth.updateUser({ password: newPassword })
  check(error)
}
