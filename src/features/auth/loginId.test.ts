import { describe, expect, it } from 'vitest'
import { credentialsFor, parseLoginId } from './loginId'

describe('parseLoginId', () => {
  it('reads an email, lower-cased and trimmed', () => {
    expect(parseLoginId('  Asha@Example.com ')).toEqual({ kind: 'email', email: 'asha@example.com' })
  })

  it.each(['9876543210', '09876543210', '+91 98765 43210', '919876543210'])('reads %s as a mobile number', (input) => {
    expect(parseLoginId(input)).toEqual({ kind: 'phone', phone: '+919876543210' })
  })

  it.each(['', '   ', 'asha@', '@example.com', 'asha at example', '12345', '5876543210', 'hello'])(
    'refuses %j',
    (input) => expect(parseLoginId(input)).toBeNull(),
  )

  it('never treats an email-looking value as a phone', () => {
    expect(parseLoginId('9876543210@x')).toBeNull()
  })

  it('gives supabase-js the right credential key', () => {
    expect(credentialsFor({ kind: 'email', email: 'a@b.co' })).toEqual({ email: 'a@b.co' })
    expect(credentialsFor({ kind: 'phone', phone: '+919876543210' })).toEqual({ phone: '+919876543210' })
  })
})
