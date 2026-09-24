import { ChevronRight } from 'lucide-react'
import type { Schemas } from '@/api/client'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'
import { signedPercent, signedPoints } from '@/lib/format'
import { KPIS, type KpiKey } from './kpis'

export function KpiChange({ kpi, ratio }: { kpi: Schemas['Kpi']; ratio: boolean }) {
  const change = ratio ? kpi.change_pp : kpi.change_pct
  if (change === null) {
    return <span className="text-xs text-subtle">No previous period to compare</span>
  }
  return (
    <span
      className={cn('text-sm font-bold tabular', change >= 0 ? 'text-positive' : 'text-negative')}
    >
      {ratio ? signedPoints(change) : signedPercent(change)}
      <span className="ml-1 font-normal text-subtle">vs previous</span>
    </span>
  )
}

export function KpiRow({
  summary,
  onOpen,
}: {
  summary: Schemas['DashboardSummary'] | undefined
  onOpen: (key: KpiKey) => void
}) {
  return (
    <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2">
      {KPIS.map((definition) => {
        const kpi = summary?.[definition.key]
        return (
          <button
            key={definition.key}
            type="button"
            onClick={() => onOpen(definition.key)}
            disabled={!kpi}
            aria-label={`${definition.label}: see where this number comes from`}
            className="group rounded-lg bg-raised p-5 text-left transition-colors duration-200 hover:bg-hover"
          >
            <p className="flex items-center justify-between text-sm text-subtle">
              {definition.label}
              <span className="flex items-center gap-0.5 text-xs opacity-0 transition-opacity group-hover:opacity-100">
                Details <ChevronRight className="size-3.5" />
              </span>
            </p>
            {kpi ? (
              <>
                <p className="mt-2 text-3xl font-bold tracking-tight tabular">
                  {definition.format(kpi.value)}
                </p>
                <div className="mt-1">
                  <KpiChange kpi={kpi} ratio={definition.ratio} />
                </div>
              </>
            ) : (
              <>
                <Skeleton className="mt-3 h-8 w-24" />
                <Skeleton className="mt-2 h-4 w-32" />
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}
