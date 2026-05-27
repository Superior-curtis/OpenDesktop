export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded bg-zinc-800/50 ${className}`}
      style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)', backgroundSize: '200% 100%' }}
    />
  )
}

export function MessageSkeleton() {
  return (
    <div className="flex gap-3 mb-6">
      <Skeleton className="w-7 h-7 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  )
}

export function SidebarSkeleton() {
  return (
    <div className="w-56 border-r border-zinc-800 p-3 space-y-3">
      <Skeleton className="h-4 w-20" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="w-3 h-3 rounded" />
          <Skeleton className="h-3 flex-1" />
        </div>
      ))}
      <Skeleton className="h-8 w-full rounded mt-4" />
    </div>
  )
}

export function ToolCallSkeleton() {
  return (
    <div className="p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/30 space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton className="w-3 h-3 rounded" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-16 w-full rounded" />
    </div>
  )
}