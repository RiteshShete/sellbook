import { ZodError } from 'zod'

/** SQLSTATE raised by order RPCs when the caller's version_no is stale. */
export const STALE_VERSION = 'SB409'

/** Shape shared by PostgrestError, StorageError and plain Errors. */
export interface DbErrorLike {
  code?: string
  message: string
}

/** Turns a Supabase/Postgres error into a sentence the owner can act on. */
export function readableDbError(error: DbErrorLike): string {
  const msg = error.message
  const lower = msg.toLowerCase()
  if (error.code === '23505') return 'That name is already used. Pick a different one.'
  if (error.code === '42501') return 'Not allowed. Try signing out and in again.'
  if (error.code === STALE_VERSION) {
    return 'This order was changed on another device. The latest version is loaded; check and try again.'
  }
  if (error.code === '28000' || lower.includes('jwt')) return 'Your session expired. Sign in again.'
  if (error.code === 'PGRST202' || lower.includes('could not find the function')) {
    return 'The database is missing an update. Apply the latest migration (supabase db push).'
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Cannot reach the server. Check your internet connection.'
  }
  if (lower.includes('payload too large') || lower.includes('exceeded the maximum allowed size')) {
    return 'That file is too large.'
  }
  // Our own RPC messages ("product not found", "restore the product first") are already readable.
  return msg.charAt(0).toUpperCase() + msg.slice(1)
}

/**
 * Message for any thrown value. A ZodError means the server sent data this app version does not
 * understand; its raw message is a JSON issue list, so show a sentence instead.
 */
export function errorMessage(e: unknown): string {
  if (e instanceof ZodError) return 'Unexpected data from the server. Reload or update the app.'
  if (e instanceof Error && e.message) return e.message
  return 'Something went wrong. Try again.'
}

/** Throws a readable Error when a Supabase call returned one. */
export function throwIfError(error: DbErrorLike | null): void {
  if (error) throw new Error(readableDbError(error))
}
