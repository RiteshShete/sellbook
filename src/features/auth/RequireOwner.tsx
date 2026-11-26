import { useMutation } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button, Skeleton } from '../../components/ui'
import { lastShop } from './lastShop'
import { isCustomerOnly, useMyContext } from './myContext'
import { useAuth } from './useAuth'

function NotAShopAccount() {
  const { signOut } = useAuth()
  const out = useMutation({ mutationFn: signOut })
  const shop = lastShop()
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6 py-8">
      <h1 className="font-display text-3xl">This account has no shop</h1>
      <p className="text-muted">
        You are signed in with a customer account. The shop owner screens are for shop owners only.
      </p>
      {shop && (
        <Link to={`/${shop}/products`} className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">
          Back to the shop
        </Link>
      )}
      <Link to="/create-shop" className="inline-flex min-h-11 items-center font-medium underline underline-offset-4">
        I have an invite code: create my shop
      </Link>
      <Button variant="secondary" block disabled={out.isPending} onClick={() => out.mutate()}>
        {out.isPending ? 'Signing out…' : 'Sign out'}
      </Button>
    </main>
  )
}

/**
 * Owner app guard (after RequireAuth). Customer-only accounts see a clear message. While the role loads a skeleton
 * shows; if it cannot be read the screen is shown anyway, because the database is what refuses (the UI only avoids
 * offering what would fail).
 */
export function RequireOwner({ children }: { children: ReactNode }) {
  const ctx = useMyContext()
  if (ctx.isPending) {
    return (
      <div className="mx-auto flex max-w-2xl lg:max-w-[75vw] flex-col gap-3 p-4" role="status" aria-label="Loading">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }
  if (ctx.data && isCustomerOnly(ctx.data)) return <NotAShopAccount />
  return <>{children}</>
}
