import { Info } from 'lucide-react'
import type { Schemas } from '@/api/client'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'
import { compact, hours, percent, signedPercent, signedPoints } from '@/lib/format'

type KpiDefinition = {
  key: 'streams' | 'viewing_hours' | 'titles_with_consumption' | 'engagement'
  label: string
  definition: string
  format: (value: number | null) => string
  ratio: boolean
}

const KPIS: KpiDefinition[] = [
  {
    key: 'streams',
    label: 'Streams',
    definition: 'Sum of streams in the period and filters.',
    format: compact,
    ratio: false,
  },
  {
    key: 'viewing_hours',
    label: 'Viewing hours',
    definition: 'Sum of viewing minutes divided by 60.',
    format: hours,
    ratio: false,
  },
  {
    key: 'titles_with_consumption',
    label: 'Titles streamed',
    definition: 'Movies with at least one stream in the period.',
    format: compact,
    ratio: false,
  },
  {
    key: 'engagement',
    label: 'Engagement',
    definition:
      'Viewing minutes divided by streams × runtime: the share of a movie watched per stream.',
    format: percent,
    ratio: true,
  },
]

function Change({ kpi, ratio }: { kpi: Schemas['Kpi']; ratio: boolean }) {
  const change = ratio ? kpi.change_pp : kpi.change_pct
  if (change === null) {
    return (
      <span className="text-xs text-subtle" title="No comparable previous period in the data.">
        No previous period
      </span>
    )
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

export function KpiRow({ summary }: { summary: Schemas['DashboardSummary'] | undefined }) {
  return (
    <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2">
      {KPIS.map((definition) => {
        const kpi = summary?.[definition.key]
        return (
          <div key={definition.key} className="rounded-lg bg-raised p-5">
            <p className="flex items-center gap-1.5 text-sm text-subtle">
              {definition.label}
              <Tooltip>
                <TooltipTrigger aria-label={`How ${definition.label} is calculated`}>
                  <Info className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>{definition.definition}</TooltipContent>
              </Tooltip>
            </p>
            {kpi ? (
              <>
                <p className="mt-2 text-3xl font-bold tracking-tight tabular">
                  {definition.format(kpi.value)}
                </p>
                <div className="mt-1">
                  <Change kpi={kpi} ratio={definition.ratio} />
                </div>
              </>
            ) : (
              <>
                <Skeleton className="mt-3 h-8 w-24" />
                <Skeleton className="mt-2 h-4 w-32" />
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
