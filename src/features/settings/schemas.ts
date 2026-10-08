import { z } from 'zod'

export const SettingsSchema = z.object({
  id: z.guid(),
  owner_id: z.guid(),
  shop_name: z.string(),
  shop_address: z.string(),
  shop_phone: z.string(),
  upi_id: z.string().nullable(),
  qr_path: z.string().nullable(),
  logo_path: z.string().nullable(),
  bill_prefix: z.string(),
  next_bill_no: z.number().int(),
  bill_footer: z.string().nullable(),
})
export type Settings = z.infer<typeof SettingsSchema>

export type AssetKind = 'qr' | 'logo'
export const ASSET_COLUMN = { qr: 'qr_path', logo: 'logo_path' } as const

// ---- Shop details form ---------------------------------------------------------------------------

export interface SettingsDraft {
  shop_name: string
  shop_address: string
  shop_phone: string
  upi_id: string
  bill_prefix: string
  bill_footer: string
}

export type SettingsPatch = Pick<
  Settings,
  'shop_name' | 'shop_address' | 'shop_phone' | 'upi_id' | 'bill_prefix' | 'bill_footer'
>

export type SettingsErrors = Partial<Record<keyof SettingsDraft, string>>

export function draftFromSettings(s: Settings): SettingsDraft {
  return {
    shop_name: s.shop_name,
    shop_address: s.shop_address,
    shop_phone: s.shop_phone,
    upi_id: s.upi_id ?? '',
    bill_prefix: s.bill_prefix,
    bill_footer: s.bill_footer ?? '',
  }
}

const SettingsFormSchema = z.object({
  shop_name: z.string().trim().min(1, 'Enter the shop name').max(80, 'Keep it under 80 characters'),
  shop_address: z.string().trim().max(300, 'Keep it under 300 characters'),
  // Printed on the bill as typed; landlines allowed, so only a loose shape check.
  shop_phone: z
    .string()
    .trim()
    .regex(/^$|^\+?[\d\s-]{6,20}$/, 'Use digits, spaces, + or - only'),
  upi_id: z
    .string()
    .trim()
    .regex(/^$|^[\w.-]{2,256}@[A-Za-z]{2,64}$/, 'Looks like name@bank, e.g. shop@okicici'),
  bill_prefix: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{0,10}$/, 'Up to 10 letters, digits or -'),
  bill_footer: z.string().trim().max(200, 'Keep it under 200 characters'),
})

export type SettingsValidation =
  { ok: true; patch: SettingsPatch } | { ok: false; errors: SettingsErrors }

export function validateSettings(draft: SettingsDraft): SettingsValidation {
  const parsed = SettingsFormSchema.safeParse(draft)
  if (!parsed.success) {
    const errors: SettingsErrors = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && key in draft && !errors[key as keyof SettingsDraft]) {
        errors[key as keyof SettingsDraft] = issue.message
      }
    }
    return { ok: false, errors }
  }
  const v = parsed.data
  return {
    ok: true,
    patch: { ...v, upi_id: v.upi_id || null, bill_footer: v.bill_footer || null },
  }
}

// ---- Image uploads (QR / logo) -------------------------------------------------------------------

export const MAX_ASSET_BYTES = 2 * 1024 * 1024
export const ASSET_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
} as const

export const AssetFileSchema = z
  .instanceof(File)
  .refine((f) => f.type in ASSET_TYPES, 'Use a PNG, JPG or WebP image')
  .refine((f) => f.size <= MAX_ASSET_BYTES, 'Image must be 2 MB or smaller')
  .refine((f) => f.size > 0, 'That file is empty')
