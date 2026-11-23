import { describe, expect, it } from 'vitest'
import { buildMail, parsePayload, safeEqual } from '../../../supabase/functions/notify-admin/mail'

const good = {
  id: '0f8fad5b-d9cb-469f-a165-70867728950e',
  shop_name: 'Asha Cakes',
  email: 'asha@example.test',
  tier: 'base',
  amount_paise: 10000,
  ref_code: 'SB-1A2B3C4D',
  utr: 'UTR12345678',
}

describe('parsePayload (notify-admin)', () => {
  it('accepts what the database trigger sends, with or without a UTR', () => {
    expect(parsePayload(good)).toEqual(good)
    expect(parsePayload({ ...good, utr: null })?.utr).toBeNull()
  })

  it('rejects anything else', () => {
    expect(parsePayload(null)).toBeNull()
    expect(parsePayload('x')).toBeNull()
    expect(parsePayload({ ...good, id: 'not-a-uuid' })).toBeNull()
    expect(parsePayload({ ...good, tier: 'trial' })).toBeNull()
    expect(parsePayload({ ...good, amount_paise: 100.5 })).toBeNull()
    expect(parsePayload({ ...good, amount_paise: '10000' })).toBeNull()
    expect(parsePayload({ ...good, ref_code: 'SB-xyz' })).toBeNull()
    expect(parsePayload({ ...good, utr: 'bad utr!' })).toBeNull()
  })
})

describe('buildMail (notify-admin)', () => {
  it('names the shop, plan, amount and reference, and links to the Admin page', () => {
    const payload = parsePayload(good)
    if (!payload) throw new Error('fixture must parse')
    const mail = buildMail(payload, 'https://example.test/sellbook/')
    expect(mail.subject).toBe('Sellbook: Rs 100 claimed for Base by Asha Cakes')
    expect(mail.text).toContain('Reference: SB-1A2B3C4D')
    expect(mail.text).toContain('UTR: UTR12345678')
    expect(mail.text).toContain(
      'Review and approve: https://example.test/sellbook/admin?req=0f8fad5b-d9cb-469f-a165-70867728950e',
    )
    expect(mail.text).toContain('Approve only after you see the money')
  })

  it('escapes a hostile shop name in the HTML and keeps the subject on one line', () => {
    const payload = parsePayload({ ...good, shop_name: '<img src=x onerror=alert(1)>\r\nBcc: evil@example.test' })
    if (!payload) throw new Error('fixture must parse')
    const mail = buildMail(payload, 'https://example.test/sellbook')
    expect(mail.html).not.toContain('<img')
    expect(mail.subject).not.toMatch(/[\r\n]/)
  })

  it('falls back to the email when the shop has no name, and shows paise', () => {
    const payload = parsePayload({ ...good, shop_name: '', amount_paise: 9950, utr: null })
    if (!payload) throw new Error('fixture must parse')
    const mail = buildMail(payload, 'https://example.test/sellbook')
    expect(mail.subject).toBe('Sellbook: Rs 99.50 claimed for Base by asha@example.test')
    expect(mail.text).toContain('UTR: not given')
  })
})

describe('safeEqual', () => {
  it('is true only for the same text', () => {
    expect(safeEqual('secret-abc', 'secret-abc')).toBe(true)
    expect(safeEqual('secret-abc', 'secret-abd')).toBe(false)
    expect(safeEqual('secret', 'secret-abc')).toBe(false)
  })
})
