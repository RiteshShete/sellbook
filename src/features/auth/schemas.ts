import { z } from 'zod'

export const LoginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
})

export type LoginInput = z.infer<typeof LoginSchema>

export type LoginErrors = Partial<Record<keyof LoginInput | 'captcha', string>>

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

const email = z.string().trim().min(1, 'Enter your email').email('Enter a valid email')
/** Same minimum as the server (config.toml / dashboard); 72 is the most bcrypt uses. */
const newPassword = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Use at most 72 characters')

export const SignupSchema = z.object({
  email,
  password: newPassword,
  accept: z.literal(true, 'Please accept the terms to continue'),
})
export const ForgotSchema = z.object({ email })
export const NewPasswordSchema = z.object({ password: newPassword })

/** First message per field for any of the auth forms; `value` is the cleaned input when everything is fine. */
export function validateForm<T>(
  schema: z.ZodType<T>,
  raw: unknown,
): { ok: true; value: T } | { ok: false; errors: Record<string, string> } {
  const parsed = schema.safeParse(raw)
  if (parsed.success) return { ok: true, value: parsed.data }
  const errors: Record<string, string> = {}
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? '')
    errors[key] ??= issue.message
  }
  return { ok: false, errors }
}

/** Turns a Supabase auth error message into something the owner can act on. */
export function readableAuthError(message: string, code?: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Wrong email, mobile number or password.'
  if (
    code === 'phone_exists' ||
    code === 'email_exists' ||
    code === 'user_already_exists' ||
    m.includes('already registered')
  ) {
    return 'This email or mobile number already has an account. Try signing in.'
  }
  if (code === 'weak_password' || m.includes('password should be at least')) return 'Use at least 8 characters.'
  if (code === 'otp_expired' || m.includes('token has expired or is invalid') || m.includes('otp expired')) {
    return 'That code is wrong or has expired. Ask for a new one.'
  }
  if (code === 'captcha_failed' || m.includes('captcha')) return 'Please complete the check and try again.'
  if (code === 'phone_provider_disabled' || m.includes('phone signups are disabled')) {
    return 'Sign-up with a mobile number is not open yet. Use an email instead.'
  }
  if (code === 'over_email_send_rate_limit') {
    return 'Too many emails were sent. Please try again in a few minutes.'
  }
  if (m.includes('email not confirmed')) return 'This email is not confirmed yet.'
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) {
    return 'New accounts are not open yet.'
  }
  if (m.includes('should be different from the old password')) {
    return 'Choose a password you have not used here before.'
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Too many attempts. Wait a minute and try again.'
  }
  if (m.includes('fetch') || m.includes('network')) {
    return 'Cannot reach the server. Check your internet connection.'
  }
  return message
}
