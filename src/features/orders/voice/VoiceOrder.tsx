import { Mic, Square } from 'lucide-react'
import { useState } from 'react'
import { Button, SegmentedControl } from '../../../components/ui'
import { toNationalPhone } from '../../../lib/phone'
import { variantLabel } from '../../../lib/variants'
import { useProducts } from '../../catalog/hooks/useCatalog'
import type { Product } from '../../catalog/schemas'
import type { OrderDraftState } from '../hooks/useOrderDraft'
import { pickedFrom } from '../components/VariantSheet'
import { parseVoiceOrder, type VoiceResult } from './parseVoiceOrder'
import { useSpeech, type VoiceLang } from './useSpeech'

const LANGS: { value: VoiceLang; label: string }[] = [
  { value: 'mr-IN', label: 'मराठी' },
  { value: 'hi-IN', label: 'हिंदी' },
  { value: 'en-IN', label: 'English' },
]
const LANG_KEY = 'sellbook.voiceLang'

function savedLang(): VoiceLang {
  try {
    return LANGS.find((l) => l.value === localStorage.getItem(LANG_KEY))?.value ?? 'mr-IN'
  } catch {
    return 'mr-IN' // storage blocked: just default
  }
}

/** Only what can be sold right now, like the product picker. */
function sellable(products: Product[]): Product[] {
  return products
    .filter((p) => p.is_active)
    .map((p) => ({ ...p, variants: p.variants.filter((v) => v.is_active) }))
    .filter((p) => p.variants.length > 0)
}

/**
 * "Speak the order": fills the form from one spoken sentence. It never saves anything; the owner reviews
 * the lines and the customer fields like any other order. Audio is handled by the phone's speech service.
 */
export function VoiceOrder({ form }: { form: OrderDraftState }) {
  const products = useProducts()
  const [lang, setLang] = useState<VoiceLang>(savedLang)
  const [heard, setHeard] = useState<{ text: string; result: VoiceResult } | null>(null)
  const speech = useSpeech(lang)

  if (!speech.supported) {
    return (
      <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">
        Voice input is not available in this browser. Try Chrome on an Android phone.
      </p>
    )
  }

  function apply(text: string) {
    const result = parseVoiceOrder(text, sellable(products.data ?? []))
    result.items.forEach((i) => form.addVariant(pickedFrom(i.product, i.variant), i.quantity))
    if (result.name) form.setField('customer_name', result.name)
    if (result.phone) form.setField('customer_phone', toNationalPhone(result.phone))
    setHeard({ text, result })
  }

  function chooseLang(l: VoiceLang) {
    setLang(l)
    try {
      localStorage.setItem(LANG_KEY, l)
    } catch {
      // storage blocked: the choice just is not remembered
    }
  }

  const r = heard?.result
  return (
    <section aria-label="Speak the order" className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl">Speak the order</h2>
        <Button
          type="button"
          variant={speech.listening ? 'secondary' : 'primary'}
          disabled={products.isPending || products.isError}
          onClick={() => (speech.listening ? speech.stop() : speech.start(apply))}
        >
          {speech.listening ? <Square className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
          {speech.listening ? 'Listening… tap to stop' : 'Tap and speak'}
        </Button>
      </div>
      <SegmentedControl label="Voice language" options={LANGS} value={lang} onChange={chooseLang} />
      <p className="text-sm text-muted">
        Say items with sizes and quantities, then name and phone. Example: “Modak Pith 500 g 2, Kanheri 1, Ravi,
        98765 43210”. Check everything below before saving.
      </p>
      {heard && r && (
        <div role="status" className="flex flex-col gap-1 rounded-xl bg-surface-2 p-3 text-sm">
          <p>
            <span className="text-muted">Heard:</span> {heard.text}
          </p>
          {r.items.map((i) => (
            <p key={i.variant.id}>
              Added {i.product.name} · {variantLabel(i.variant)} × {i.quantity}
            </p>
          ))}
          {r.name && <p>Name: {r.name}</p>}
          {r.phone && <p>Phone: {toNationalPhone(r.phone)}</p>}
          {r.ambiguous.map((n) => (
            <p key={n} className="text-danger">
              {n}: which size? Tap it below to choose.
            </p>
          ))}
          {r.unmatched && <p className="text-danger">Not understood: {r.unmatched}</p>}
          {r.items.length === 0 && !r.name && !r.phone && r.ambiguous.length === 0 && (
            <p className="text-danger">Nothing matched your products. Try again, or pick items below.</p>
          )}
        </div>
      )}
    </section>
  )
}
