import { z } from 'zod'

export const LoginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
})

export type LoginInput = z.infer<typeof LoginSchema>

export type LoginErrors = Partial<Record<keyof LoginInput, string>>

export type LoginValidation = { ok: true; value: LoginInput } | { ok: false; errors: LoginErrors }

/** Validates the login form; returns the first message per field. */
export function validateLogin(raw: { email: string; password: string }): LoginValidation {
  const parsed = LoginSchema.safeParse(raw)
  if (parsed.success) return { ok: true, value: parsed.data }
  const errors: LoginErrors = {}
  for (const issue of parsed.error.issues) {
    const key = issue.path[0]
    if ((key === 'email' || key === 'password') && !errors[key]) errors[key] = issue.message
  }
  return { ok: false, errors }
}

/** Turns a Supabase auth error message into something the owner can act on. */
export function readableAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Wrong email or password.'
  if (m.includes('email not confirmed')) return 'This email is not confirmed yet.'
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Too many attempts. Wait a minute and try again.'
  }
  if (m.includes('fetch') || m.includes('network')) {
    return 'Cannot reach the server. Check your internet connection.'
  }
  return message
}
