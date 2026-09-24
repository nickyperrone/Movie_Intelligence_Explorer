import { Skeleton } from '@/components/ui/skeleton'

// Shown while a page's code loads: the title and a few panels in the shape of a typical page.
export function PageSkeleton() {
  return (
    <div className="space-y-6 pt-4" aria-busy aria-label="Loading page">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 w-2/3 max-w-lg" />
      <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  )
}
