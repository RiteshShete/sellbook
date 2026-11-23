import { useState } from 'react'
import { Switch, toast } from '../../../components/ui'
import { useSetPublished } from '../hooks/useShop'
import { MISSING_TEXT, type PublishResult, type Shop } from '../schemas'

/** Publishing runs the server's checklist; what is still missing is listed in plain words. */
export function PublishPanel({ shop }: { shop: Shop }) {
  const publish = useSetPublished()
  const [missing, setMissing] = useState<PublishResult['missing']>([])

  function onToggle(on: boolean) {
    publish.mutate(on, {
      onSuccess: (r) => {
        setMissing(r.missing)
        if (on && r.published) toast.success('Your shop is live')
        if (!on) toast.success('Your shop is hidden')
      },
    })
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <h2 className="font-display text-xl">Publish</h2>
      <Switch
        label={shop.is_published ? 'Live: customers can see and order' : 'Hidden: only you can see it'}
        checked={shop.is_published}
        disabled={publish.isPending}
        onChange={onToggle}
      />
      {missing.length > 0 && (
        <div role="alert" className="rounded-xl bg-danger-soft p-3 text-sm text-danger-ink">
          <p className="font-medium">Before you publish:</p>
          <ul className="mt-1 list-disc pl-5">
            {missing.map((m) => (
              <li key={m}>{MISSING_TEXT[m]}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-sm text-muted">
        Your web address is <span className="font-medium">{shop.slug}</span>.{' '}
        {shop.ever_published ? 'It can no longer be changed.' : 'It is locked once you publish.'}
      </p>
    </section>
  )
}
