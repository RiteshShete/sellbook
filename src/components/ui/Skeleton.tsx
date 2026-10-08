export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xl bg-surface-2 ${className || 'h-5 w-full'}`}
    />
  )
}
