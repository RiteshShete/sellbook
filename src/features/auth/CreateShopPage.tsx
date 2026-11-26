import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Input, toast } from '../../components/ui'
import { queryKeys } from '../../lib/queryKeys'
import { slugProblem, suggestSlug } from '../../lib/slug'
import { createShop, isSlugAvailable } from './shopApi'
import { useAuth } from './useAuth'

/** The value after it has stopped changing for `ms` (so the server is asked once the owner pauses typing). */
function useDebounced<T>(value: T, ms: number): T {
  const [out, setOut] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setOut(value), ms)
    return () => window.clearTimeout(timer)
  }, [value, ms])
  return out
}

/** The link customers will use, built from where the app is served (works under /sellbook/ and on a domain). */
const shopLink = (slug: string) =>
  `${window.location.origin}${import.meta.env.BASE_URL}${slug || 'your-shop'}/products`

/**
 * Finish setting up: a shop name, the web address customers will use, and the invite code (pilot).
 * Also the retry screen when sign-up worked but creating the shop did not.
 */
export function CreateShopPage() {
  const { client } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [invite, setInvite] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const localProblem = slug ? slugProblem(slug) : null
  const slugToAsk = useDebounced(localProblem || !slug ? '' : slug, 400)
  const available = useQuery({
    queryKey: ['slugAvailable', slugToAsk],
    queryFn: () => isSlugAvailable(client, slugToAsk),
    enabled: slugToAsk !== '',
    staleTime: 30_000,
  })
  const slugMessage =
    localProblem ??
    (slugToAsk === slug && available.data === false ? 'That address is already taken. Try another.' : null)

  const create = useMutation({
    mutationFn: () => createShop(client, { invite, slug, name }),
    onSuccess: async (shop) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.myContext })
      toast.success('Your shop is set up')
      navigate(`/more?shop=${shop.slug}`, { replace: true })
    },
    onError: (e: Error) => setErrors({ form: e.message }),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'Enter your shop name'
    if (!slug) next.slug = 'Choose a web address'
    else if (slugMessage) next.slug = slugMessage
    if (!invite.trim()) next.invite = 'Enter your invite code'
    setErrors(next)
    if (Object.keys(next).length === 0) create.mutate()
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-6 py-[max(2rem,env(safe-area-inset-top))]">
      <h1 className="font-display text-3xl">Set up your online shop</h1>
      <p className="text-muted">Customers will order from a page of your own. You need an invite code to start.</p>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Shop name"
          autoComplete="organization"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            if (!slugEdited) setSlug(suggestSlug(e.target.value))
            setErrors({})
          }}
          error={errors.name}
        />
        <div className="flex flex-col gap-1">
          <Input
            label="Web address"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value.toLowerCase())
              setSlugEdited(true)
              setErrors({})
            }}
            error={errors.slug ?? slugMessage ?? undefined}
          />
          <p className="break-all text-sm text-muted" aria-live="polite">
            {!slugMessage && slugToAsk === slug && available.data === true
              ? `Free. Your link: ${shopLink(slug)}`
              : `Your link: ${shopLink(slug)}`}
          </p>
          <p className="text-sm text-muted">You cannot change this address after your shop is published.</p>
        </div>
        <Input
          label="Invite code"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={invite}
          onChange={(e) => {
            setInvite(e.target.value)
            setErrors({})
          }}
          error={errors.invite}
        />
        {errors.form && (
          <p role="alert" className="text-sm text-danger">
            {errors.form}
          </p>
        )}
        <Button type="submit" block disabled={create.isPending}>
          {create.isPending ? 'Setting up…' : 'Create my shop'}
        </Button>
      </form>
      <Link to="/" className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">
        Not now
      </Link>
    </main>
  )
}
