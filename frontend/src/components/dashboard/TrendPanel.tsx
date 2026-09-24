import type { Schemas } from '@/api/client'
import { useDashboardTrend, type DashboardQuery } from '@/api/queries'
import { SERIES_COLORS } from '@/components/charts/colors'
import { TrendChart, type TrendSeries } from '@/components/charts/TrendChart'
import { CountryLabel, PlatformLabel } from '@/components/common/Brand'
import { Pill } from '@/components/common/Pill'
import { SourceNote } from '@/components/common/SourceNote'
import { ErrorState, Panel } from '@/components/common/States'
import { Skeleton } from '@/components/ui/skeleton'
import { compact, hours, monthRange } from '@/lib/format'
import { SOURCES } from './sources'

export type Compare = 'total' | 'platform' | 'country' | 'previous'
type Metric = 'streams' | 'hours'

const COMPARE_OPTIONS: { id: Compare; label: string }[] = [
  { id: 'total', label: 'Total' },
  { id: 'platform', label: 'By platform' },
  { id: 'country', label: 'By country' },
  { id: 'previous', label: 'vs previous period' },
]

type TrendPanelProps = {
  query: DashboardQuery
  summary: Schemas['DashboardSummary'] | undefined
  metric: Metric
  compare: Compare
  onMetric: (metric: Metric) => void
  onCompare: (compare: Compare) => void
}

function pick(points: Schemas['MonthlyPoint'][], metric: Metric): number[] {
  return points.map((point) => (metric === 'hours' ? point.viewing_hours : point.streams))
}

export function TrendPanel({
  query,
  summary,
  metric,
  compare,
  onMetric,
  onCompare,
}: TrendPanelProps) {
  const groupBy = compare === 'platform' || compare === 'country' ? compare : undefined
  const trend = useDashboardTrend(query, groupBy)
  const previousPeriod = summary?.previous_period ?? null
  const previous = useDashboardTrend(
    { ...query, start: previousPeriod?.start, end: previousPeriod?.end },
    undefined,
    compare === 'previous' && previousPeriod !== null,
  )
  const metricLabel = metric === 'hours' ? 'Viewing hours' : 'Streams'
  const data = trend.data

  let series: TrendSeries[] = []
  if (data) {
    if (groupBy) {
      series = data.groups.map((group, index) => ({
        key: group.key,
        name: group.key,
        label:
          groupBy === 'country' ? (
            <CountryLabel country={group.key} />
          ) : (
            <PlatformLabel platform={group.key} />
          ),
        color: SERIES_COLORS[index % SERIES_COLORS.length],
        values: pick(group.series, metric),
      }))
    } else {
      const current = monthRange(data.filters.start, data.filters.end)
      series = [
        {
          key: 'current',
          name: current,
          label: current,
          color: SERIES_COLORS[0],
          values: pick(data.series, metric),
        },
      ]
      if (compare === 'previous' && previous.data && previousPeriod) {
        const label = monthRange(previousPeriod.start, previousPeriod.end)
        series.push({
          key: 'previous',
          name: label,
          label,
          color: '#b3b3b3',
          values: pick(previous.data.series, metric),
          dashed: true,
        })
      }
    }
  }

  return (
    <Panel
      title={`${metricLabel} per month`}
      aside={
        <div className="flex items-center gap-2">
          <Pill active={metric === 'streams'} onClick={() => onMetric('streams')}>
            Streams
          </Pill>
          <Pill active={metric === 'hours'} onClick={() => onMetric('hours')}>
            Hours
          </Pill>
          <SourceNote>{SOURCES.trend}</SourceNote>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Compare">
        <span className="mr-1 text-sm text-subtle">Compare</span>
        {COMPARE_OPTIONS.map((option) => {
          const unavailable =
            option.id === 'previous' && summary !== undefined && previousPeriod === null
          return (
            <Pill
              key={option.id}
              active={compare === option.id}
              disabled={unavailable}
              title={unavailable ? 'The previous period starts before Jan 2023.' : undefined}
              className="disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => onCompare(option.id)}
            >
              {option.label}
            </Pill>
          )
        })}
      </div>
      {trend.isError ? (
        <ErrorState error={trend.error} onRetry={() => trend.refetch()} />
      ) : !data ? (
        <Skeleton className="h-[300px]" />
      ) : (
        <TrendChart
          months={data.series.map((point) => point.month)}
          series={series}
          metricLabel={metricLabel}
          format={metric === 'hours' ? hours : compact}
          unit={metric === 'hours' ? ' h' : ''}
        />
      )}
    </Panel>
  )
}
