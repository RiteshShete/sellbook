import { useSyncExternalStore } from 'react'
import { TellCustomerSheet, type TellState } from './TellCustomerSheet'

/**
 * "Tell the customer" must outlive the card that started it: confirming an order removes it from the needs-action list,
 * which unmounts that card. So the sheet's state lives here, and <TellCustomerHost /> (mounted once in the app frame) shows it.
 */
let current: TellState | null = null
const listeners = new Set<() => void>()

function set(next: TellState | null) {
  current = next
  listeners.forEach((l) => l())
}

export const showTell = (state: TellState): void => set(state)

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => void listeners.delete(l)
}

export function TellCustomerHost() {
  const state = useSyncExternalStore(subscribe, () => current, () => null)
  return <TellCustomerSheet state={state} onClose={() => set(null)} />
}
