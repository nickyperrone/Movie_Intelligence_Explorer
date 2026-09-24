import { useAvailability } from '@/api/queries'
import { SectionHeader } from '@/components/common/SectionHeader'
import { EmptyState, ErrorState } from '@/components/common/States'
import { Skeleton } from '@/components/ui/skeleton'
import { monthLabel } from '@/lib/format'

export function AvailabilitySection({ titleId }: { titleId: string }) {
  const availability = useAvailability(titleId)
  const data = availability.data
  return (
    <section>
      <SectionHeader
        title="Where to watch"
        description={
          data?.snapshot_month
            ? `Availability snapshot, ${monthLabel(data.snapshot_month)}`
            : 'Availability snapshot'
        }
      />
      {availability.isError ? (
        <ErrorState error={availability.error} onRetry={() => availability.refetch()} />
      ) : !data ? (
        <Skeleton className="h-40" />
      ) : data.offers.length === 0 ? (
        <EmptyState message="Not available on any tracked platform in the Jun 2026 snapshot." />
      ) : (
        <div className="overflow-x-auto rounded-lg bg-raised">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b text-left text-subtle">
              <tr>
                <th scope="col" className="px-4 py-3 font-normal">
                  Platform
                </th>
                <th scope="col" className="py-3 font-normal">
                  Type
                </th>
                <th scope="col" className="py-3 font-normal">
                  Original
                </th>
                <th scope="col" className="px-4 py-3 font-normal">
                  Countries
                </th>
              </tr>
            </thead>
            <tbody>
              {data.offers.map((offer) => (
                <tr
                  key={`${offer.platform}-${offer.platform_type}`}
                  className="border-b border-white/5 last:border-none"
                >
                  <td className="px-4 py-3 font-medium">{offer.platform}</td>
                  <td className="py-3">
                    <span className="rounded-full bg-pill px-2 py-0.5 text-xs font-bold">
                      {offer.platform_type}
                    </span>
                  </td>
                  <td className="py-3 text-subtle">
                    {offer.is_original ? offer.original_flag : '—'}
                  </td>
                  <td className="px-4 py-3">{offer.countries.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
