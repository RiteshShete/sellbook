/**
 * Small looping picture for empty screens: a card slides onto a stack of two. Decorative (hidden
 * from screen readers); colours are tokens only. Motion stops under "reduce motion" (global rule).
 */
export function EmptyArt() {
  return (
    <div aria-hidden className="relative mb-2 h-20 w-40">
      <div className="absolute inset-x-6 top-1 h-14 rounded-2xl border border-border bg-surface-2" />
      <div className="absolute inset-x-3 top-4 h-14 rounded-2xl border border-border bg-surface-2" />
      <div className="art-slide absolute inset-x-0 top-7 flex h-14 items-center gap-2 rounded-2xl border border-order-card-border bg-order-card px-3">
        <span className="size-6 shrink-0 rounded-full bg-lime" />
        <span className="flex flex-1 flex-col gap-1.5">
          <span className="h-2 w-3/4 rounded-full bg-text/20" />
          <span className="h-2 w-1/2 rounded-full bg-text/10" />
        </span>
      </div>
    </div>
  )
}
