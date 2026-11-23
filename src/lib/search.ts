/** Lower-cases and composes Unicode so "कण्हेरी" typed or pasted either way matches; Latin ignores case. */
export function normalizeSearch(text: string): string {
  return text.normalize('NFC').toLocaleLowerCase('mr').trim()
}
