import { useInsight } from '@/api/queries'
import { Narrative } from '@/components/common/Narrative'
import { ErrorState, Panel } from '@/components/common/States'
import { Skeleton } from '@/components/ui/skeleton'
import { compact, hours, monthLabel, percent } from '@/lib/format'

export function InsightPanel({ titleId }: { titleId: string }) {
  const insight = useInsight(titleId)
  if (insight.isError) return <ErrorState error={insight.error} onRetry={() => insight.refetch()} />
  if (!insight.data) return <Skeleton className="h-48" />
  const { facts, narrative } = insight.data
  if (facts.total_streams === 0) return null

  const rows: [string, string][] = [
    ['Total streams', compact(facts.total_streams)],
    ['Viewing hours', hours(facts.viewing_hours)],
    [
      'Months with streams',
      `${facts.months_with_data} (${monthLabel(facts.first_month)} to ${monthLabel(facts.last_month)})`,
    ],
    ['Peak month', `${monthLabel(facts.peak_month)}, ${compact(facts.peak_streams)} streams`],
    ['Top country', `${facts.top_country ?? '—'} (${percent(facts.top_country_share)})`],
    ['Top platform', `${facts.top_platform ?? '—'} (${percent(facts.top_platform_share)})`],
    ['Engagement', percent(facts.engagement)],
  ]
  return (
    <Panel title="Key facts">
      <div className="grid gap-6 lg:grid-cols-2">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-subtle">{label}</dt>
              <dd className="tabular">{value}</dd>
            </div>
          ))}
        </dl>
        <Narrative status={narrative.status} text={narrative.text} />
      </div>
    </Panel>
  )
}
