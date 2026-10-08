import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { Skeleton } from '../components/ui'
import { TabBar } from './TabBar'

function PageFallback() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3 p-4" role="status" aria-label="Loading">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

export function AppLayout() {
  return (
    <div className="flex min-h-dvh min-w-0 flex-col">
      <main className="min-w-0 flex-1 pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <TabBar />
    </div>
  )
}
