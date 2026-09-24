import { Link } from 'react-router'
import type { Schemas } from '@/api/client'
import { useDashboardBreakdown, useDashboardTitles, type DashboardQuery } from '@/api/queries'
import { BarList } from '@/components/charts/BarList'
import { CountryLabel, PlatformLabel } from '@/components/common/Brand'
import { Poster } from '@/components/common/Poster'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { compact, monthRange, percent } from '@/lib/format'
import { KpiChange } from './KpiRow'
import { KPIS, type KpiKey } from './kpis'

type KpiDetailProps = {
  kpiKey: KpiKey | null
  query: DashboardQuery
  summary: Schemas['DashboardSummary']
  onClose: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-white/10 pt-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-subtle">{title}</h3>
      {children}
    </section>
  )
}

function Split({
  query,
  kpiKey,
  dimension,
}: {
  query: DashboardQuery
  kpiKey: KpiKey
  dimension: 'platform' | 'country'
}) {
  const definition = KPIS.find((k) => k.key === kpiKey)!
  const breakdown = useDashboardBreakdown(query, dimension)
  if (!breakdown.data) return <Skeleton className="h-28" />
  return (
    <BarList
      label={`${definition.label} by ${dimension}`}
      format={definition.contributionFormat}
      items={breakdown.data.items
        .map((item) => ({
          key: item.key,
          label:
            dimension === 'country' ? (
              <CountryLabel country={item.key} />
            ) : (
              <PlatformLabel platform={item.key} />
            ),
          value: definition.contribution(item),
        }))
        .sort((a, b) => b.value - a.value)}
    />
  )
}

function TopContributors({ query, kpiKey }: { query: DashboardQuery; kpiKey: KpiKey }) {
  const definition = KPIS.find((k) => k.key === kpiKey)!
  const titles = useDashboardTitles(query, definition.titleSort)
  const items = titles.data?.pages[0].items.slice(0, 5)
  if (!items) return <Skeleton className="h-40" />
  const value = (item: Schemas['RankedTitle']) =>
    kpiKey === 'viewing_hours'
      ? `${compact(item.viewing_hours)} h`
      : kpiKey === 'engagement'
        ? `${percent(item.engagement)} of ${compact(item.streams)} streams`
        : `${compact(item.streams)} streams`
  return (
    <ol className="space-y-2">
      {items.map((item) => (
        <li key={item.movie.title_id}>
          <Link
            to={`/movies/${item.movie.title_id}`}
            className="flex items-center gap-3 rounded-md p-1 hover:bg-white/5"
          >
            <Poster
              src={item.movie.image_url}
              title={item.movie.title}
              className="h-12 w-8 shrink-0 rounded-sm text-[9px]"
            />
            <span className="min-w-0 flex-1 truncate">{item.movie.title}</span>
            <span className="shrink-0 text-subtle tabular">{value(item)}</span>
          </Link>
        </li>
      ))}
    </ol>
  )
}

export function KpiDetail({ kpiKey, query, summary, onClose }: KpiDetailProps) {
  const definition = KPIS.find((k) => k.key === kpiKey)
  const kpi = kpiKey ? summary[kpiKey] : null
  const filters = [
    ...query.countries,
    ...query.platforms,
    ...query.genres.map((genre) => `${genre} (primary genre)`),
    ...query.distributors.map((distributor) => `Distributor: ${distributor}`),
  ]
  return (
    <Sheet open={kpiKey !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto border-none bg-raised sm:max-w-md">
        {definition && kpi && kpiKey && (
          <div className="space-y-5 p-6">
            <SheetHeader className="p-0">
              <SheetDescription className="text-subtle">
                Where this number comes from
              </SheetDescription>
              <SheetTitle className="text-2xl font-black text-white">{definition.label}</SheetTitle>
            </SheetHeader>
            <div>
              <p className="text-4xl font-bold tracking-tight tabular">
                {definition.format(kpi.value)}
              </p>
              <KpiChange kpi={kpi} ratio={definition.ratio} />
            </div>
            <Section title="How it is calculated">
              <p className="leading-relaxed">{definition.formula}</p>
              <p className="mt-2 text-subtle">{definition.source}</p>
            </Section>
            <Section title="Periods">
              <dl className="grid grid-cols-[1fr_auto] gap-y-1">
                <dt>{monthRange(summary.filters.start, summary.filters.end)}</dt>
                <dd className="font-bold tabular">{definition.format(kpi.value)}</dd>
                <dt className="text-subtle">
                  {summary.previous_period
                    ? monthRange(summary.previous_period.start, summary.previous_period.end)
                    : 'Previous period'}
                </dt>
                <dd className="text-subtle tabular">
                  {summary.previous_period
                    ? definition.format(kpi.previous)
                    : 'Before the data starts'}
                </dd>
              </dl>
            </Section>
            <Section
              title={kpiKey === 'engagement' ? 'Streams behind it, by platform' : 'By platform'}
            >
              <Split query={query} kpiKey={kpiKey} dimension="platform" />
            </Section>
            <Section
              title={kpiKey === 'engagement' ? 'Streams behind it, by country' : 'By country'}
            >
              <Split query={query} kpiKey={kpiKey} dimension="country" />
            </Section>
            <Section
              title={
                kpiKey === 'engagement'
                  ? 'Most streamed titles and their engagement'
                  : 'Titles that contribute most'
              }
            >
              <TopContributors query={query} kpiKey={kpiKey} />
            </Section>
            <Section title="Filters applied">
              <p className="text-subtle">
                {filters.length
                  ? filters.join(' · ')
                  : 'None: all countries, platforms, genres and distributors.'}
              </p>
            </Section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
