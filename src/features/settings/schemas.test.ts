import { describe, expect, it } from 'vitest'
import { AssetFileSchema, MAX_ASSET_BYTES, validateSettings, type SettingsDraft } from './schemas'

const draft = (over: Partial<SettingsDraft> = {}): SettingsDraft => ({
  shop_name: ' Asha Bakes ',
  shop_address: 'Shop 4, MG Road\nPune',
  shop_phone: '+91 98765 43210',
  upi_id: 'asha@okicici',
  payee_name: 'Asha Bakes',
  use_dynamic_qr: true,
  bill_prefix: 'AB',
  bill_footer: '',
  ...over,
})

describe('validateSettings', () => {
  it('trims and turns empty optionals into null', () => {
    const r = validateSettings(draft({ upi_id: '  ' }))
    expect(r).toEqual({
      ok: true,
      patch: {
        shop_name: 'Asha Bakes',
        shop_address: 'Shop 4, MG Road\nPune',
        shop_phone: '+91 98765 43210',
        upi_id: null,
        payee_name: 'Asha Bakes',
        use_dynamic_qr: true,
        bill_prefix: 'AB',
        bill_footer: null,
      },
    })
  })

  it('reports each bad field once', () => {
    const r = validateSettings(
      draft({ shop_name: '', upi_id: 'not-upi', bill_prefix: 'TOO LONG!', shop_phone: 'call me' }),
    )
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual([
        'bill_prefix',
        'shop_name',
        'shop_phone',
        'upi_id',
      ])
    }
  })

  it('trims the UPI ID and accepts a Devanagari payee name', () => {
    const r = validateSettings(draft({ upi_id: '  asha@okicici ', payee_name: ' आशा केक्स ' }))
    expect(r.ok && r.patch.upi_id).toBe('asha@okicici')
    expect(r.ok && r.patch.payee_name).toBe('आशा केक्स')
  })

  it('stores an empty payee name as null and rejects one over 50 characters', () => {
    const empty = validateSettings(draft({ payee_name: '  ' }))
    expect(empty.ok && empty.patch.payee_name).toBeNull()
    const long = validateSettings(draft({ payee_name: 'x'.repeat(51) }))
    expect(long.ok).toBe(false)
    if (!long.ok) expect(Object.keys(long.errors)).toEqual(['payee_name'])
  })

  it('allows an empty bill prefix (DB allows 0-10 chars)', () => {
    expect(validateSettings(draft({ bill_prefix: '' })).ok).toBe(true)
  })
})

describe('AssetFileSchema', () => {
  const file = (type: string, size: number) => new File([new Uint8Array(size)], 'qr', { type })

  it('accepts png/jpeg/webp up to 2 MB', () => {
    expect(AssetFileSchema.safeParse(file('image/png', 10)).success).toBe(true)
    expect(AssetFileSchema.safeParse(file('image/webp', MAX_ASSET_BYTES)).success).toBe(true)
  })

  it('rejects other types, oversize, empty and non-files', () => {
    expect(AssetFileSchema.safeParse(file('image/gif', 10)).success).toBe(false)
    expect(AssetFileSchema.safeParse(file('image/png', MAX_ASSET_BYTES + 1)).success).toBe(false)
    expect(AssetFileSchema.safeParse(file('image/png', 0)).success).toBe(false)
    expect(AssetFileSchema.safeParse('qr.png').success).toBe(false)
  })
})
