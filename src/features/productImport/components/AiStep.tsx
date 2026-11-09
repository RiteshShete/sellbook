import { Copy } from 'lucide-react'
import { Button, toast } from '../../../components/ui'
import { copyText } from '../files'
import { AI_INSTRUCTIONS } from '../importSchema'

/** Step 2: the instructions to paste into any AI tool next to a photo of the price list. */
export function AiStep({ announce }: { announce: (message: string) => void }) {
  async function copy() {
    const ok = await copyText(AI_INSTRUCTIONS)
    const msg = ok ? 'Instructions copied' : 'Could not copy. Select the text and copy it yourself.'
    if (ok) toast.success(msg)
    else toast.error(msg)
    announce(msg)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="rounded-xl bg-surface-2 p-3 text-sm">
        Attach a clear photo of your list, paste the instructions, and ask for CSV only. Check
        prices before uploading; AI can misread them.
      </p>
      <Button onClick={() => void copy()}>
        <Copy className="h-4 w-4" aria-hidden /> Copy instructions for AI
      </Button>
      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-3 font-medium underline underline-offset-4">
          Show the instructions
        </summary>
        <p className="rounded-xl border border-border bg-surface p-3 break-words text-muted">
          {AI_INSTRUCTIONS}
        </p>
      </details>
    </div>
  )
}
