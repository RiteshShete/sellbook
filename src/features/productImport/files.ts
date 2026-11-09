import { useSyncExternalStore } from 'react'
import { toCsv } from '../../lib/csv'
import type { ImportPlan } from './planImport'

/** Saves text as a file (the BOM inside the text is kept, so Excel reads Devanagari). */
export function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Clipboard write; falls back to a hidden textarea where the async API is blocked (some in-app browsers). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const box = document.createElement('textarea')
    box.value = text
    box.setAttribute('readonly', '')
    box.style.position = 'fixed'
    box.style.opacity = '0'
    document.body.append(box)
    box.select()
    const ok = document.execCommand('copy')
    box.remove()
    return ok
  }
}

/** Errors and warnings of a plan as a CSV: row, type, message. */
export function errorReportCsv(plan: ImportPlan): string {
  return toCsv([
    ['row', 'type', 'message'],
    ...plan.errors.map((i) => [i.line, 'error', i.message]),
    ...plan.warnings.map((i) => [i.line, 'warning', i.message]),
  ])
}

const subscribe = (cb: () => void) => {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

/** Live browser online state. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  )
}
