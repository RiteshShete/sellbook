import { useId } from 'react'
import { cleanOtp, otpDigits, OTP_LENGTH } from '../otp'

interface OtpInputProps {
  value: string
  onChange: (code: string) => void
  label?: string
  error?: string
  autoFocus?: boolean
  /** Called once when the sixth digit is in (typed, pasted or filled by the phone's autofill). */
  onComplete?: (code: string) => void
}

/**
 * The 6-digit emailed code. Six boxes are drawn, but ONE real input sits on top of them, so paste, the keyboard's
 * "code from email" suggestion (autocomplete=one-time-code), backspace and screen readers all behave normally.
 */
export function OtpInput({ value, onChange, label = 'Code from the email', error, autoFocus, onComplete }: OtpInputProps) {
  const id = useId()
  const digits = otpDigits(value)

  function handle(raw: string) {
    const next = cleanOtp(raw)
    onChange(next)
    if (next.length === OTP_LENGTH && next !== value) onComplete?.(next)
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-muted">
        {label}
      </label>
      <div className="relative">
        <div className="flex gap-2" aria-hidden="true">
          {digits.map((d, i) => (
            <span
              key={i}
              className={`grid h-12 min-w-0 flex-1 place-items-center rounded-xl border bg-surface text-xl ${
                error ? 'border-danger' : i === value.length ? 'border-text' : 'border-border-strong'
              }`}
            >
              {d}
            </span>
          ))}
        </div>
        <input
          id={id}
          value={value}
          onChange={(e) => handle(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent opacity-0 focus:opacity-0"
        />
      </div>
      {error && (
        <p id={`${id}-err`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
