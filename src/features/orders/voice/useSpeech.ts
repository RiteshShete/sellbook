import { useEffect, useRef, useState } from 'react'
import { toast } from '../../../components/ui'
import { errorMessage } from '../../../lib/dbError'

export type VoiceLang = 'mr-IN' | 'hi-IN' | 'en-IN'

/** The browser's recognizer; lib.dom has the event types but no constructor, so only what we use is declared. */
interface Recognizer {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognizerCtor = new () => Recognizer

function recognizerCtor(): RecognizerCtor | null {
  // Platform boundary: the constructor is not in the DOM typings, and Chrome/Safari expose it with a webkit prefix.
  const w = window as unknown as {
    SpeechRecognition?: RecognizerCtor
    webkitSpeechRecognition?: RecognizerCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'The microphone is blocked. Allow it in the browser settings and try again.',
  'service-not-allowed': 'Voice input is blocked on this phone.',
  'no-speech': 'Did not hear anything. Tap the mic and speak.',
  'audio-capture': 'No microphone found.',
  network: 'Voice input needs an internet connection.',
  'language-not-supported': 'This phone cannot recognise that language. Pick another.',
}

/** One tap = one sentence. `start(onText)` calls onText with the final transcript; failures show as toasts. */
export function useSpeech(lang: VoiceLang) {
  const [listening, setListening] = useState(false)
  const rec = useRef<Recognizer | null>(null)
  const supported = recognizerCtor() !== null

  useEffect(() => () => rec.current?.abort(), [])

  function start(onText: (text: string) => void) {
    const Ctor = recognizerCtor()
    if (!Ctor) return
    const r = new Ctor()
    r.lang = lang
    r.continuous = false
    r.interimResults = false
    r.maxAlternatives = 1
    r.onresult = (e) => {
      const text = Array.from(e.results, (res) => res[0]?.transcript ?? '').join(' ').trim()
      if (text) onText(text)
    }
    r.onerror = (e) => {
      if (e.error !== 'aborted') toast.error(ERRORS[e.error] ?? 'Voice input failed. Try again.')
    }
    r.onend = () => setListening(false)
    rec.current = r
    setListening(true)
    try {
      r.start()
    } catch (err) {
      setListening(false)
      toast.error(errorMessage(err))
    }
  }

  return { supported, listening, start, stop: () => rec.current?.stop() }
}
