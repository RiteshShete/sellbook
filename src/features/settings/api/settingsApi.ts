import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { todayIST } from '../../../lib/dates'
import { throwIfError } from '../../../lib/dbError'
import { uuid } from '../../../lib/id'
import {
  ASSET_COLUMN,
  ASSET_TYPES,
  AssetFileSchema,
  SettingsSchema,
  type AssetKind,
  type Settings,
  type SettingsPatch,
} from '../schemas'

const BUCKET = 'assets'

/** Returns the owner's settings, creating the row on first use. */
export async function fetchSettings(client: SupabaseClient): Promise<Settings> {
  const { data, error } = await client.rpc('init_settings')
  throwIfError(error)
  return SettingsSchema.parse(data)
}

export async function updateSettings(
  client: SupabaseClient,
  id: string,
  patch: Partial<SettingsPatch> & { qr_path?: string | null; logo_path?: string | null },
): Promise<Settings> {
  const { data, error } = await client.from('settings').update(patch).eq('id', id).select().single()
  throwIfError(error)
  return SettingsSchema.parse(data)
}

export interface AssetChangeResult {
  settings: Settings
  /** The previous image could not be removed from storage (harmless, but worth telling). */
  oldFileLeft: boolean
}

async function removeObject(client: SupabaseClient, path: string | null): Promise<boolean> {
  if (!path) return true
  const { error } = await client.storage.from(BUCKET).remove([path])
  return error === null
}

/** Uploads a QR/logo, points settings at it, then removes the old file. */
export async function uploadAsset(
  client: SupabaseClient,
  settings: Settings,
  kind: AssetKind,
  input: unknown,
): Promise<AssetChangeResult> {
  const parsed = AssetFileSchema.safeParse(input)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Invalid image')
  const file = parsed.data
  const ext = ASSET_TYPES[file.type as keyof typeof ASSET_TYPES]
  // Storage policy requires <owner_id>/<yyyy>/<file>.
  const path = `${settings.owner_id}/${todayIST().slice(0, 4)}/${kind}-${uuid()}.${ext}`

  const up = await client.storage.from(BUCKET).upload(path, file, { contentType: file.type })
  throwIfError(up.error)

  const column = ASSET_COLUMN[kind]
  let updated: Settings
  try {
    updated = await updateSettings(client, settings.id, { [column]: path })
  } catch (e) {
    await removeObject(client, path) // don't leave an unreferenced upload behind
    throw e
  }
  const oldFileLeft = !(await removeObject(client, settings[column]))
  return { settings: updated, oldFileLeft }
}

export async function removeAsset(
  client: SupabaseClient,
  settings: Settings,
  kind: AssetKind,
): Promise<AssetChangeResult> {
  const column = ASSET_COLUMN[kind]
  const updated = await updateSettings(client, settings.id, { [column]: null })
  const oldFileLeft = !(await removeObject(client, settings[column]))
  return { settings: updated, oldFileLeft }
}

/** Private bucket: fetch the image as a Blob with the owner's session (never a public URL). */
export async function downloadAsset(client: SupabaseClient, path: string): Promise<Blob> {
  const { data, error } = await client.storage.from(BUCKET).download(path)
  throwIfError(error)
  return z.instanceof(Blob).parse(data)
}
