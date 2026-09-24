import { CountryLabel, GenreLabel, PlatformLabel } from '@/components/common/Brand'
import { useMemo } from 'react'
import type { Schemas } from '@/api/client'
import {
  useDashboardBreakdown,
  useDashboardChanges,
  useDashboardMatrix,
  useDashboardSummary,
  useDashboardTitles,
  useDashboardTrend,
  useFilterOptions,
  type DashboardQuery,
} from '@/api/queries'
import { BarList } from '@/components/charts/BarList'
import { MatrixGrid } from '@/components/charts/MatrixGrid'
import { TrendChart } from '@/components/charts/TrendChart'
import { Pill } from '@/components/common/Pill'
import { EmptyState, ErrorState, Panel } from '@/components/common/States'
import { ChangesPanel } from '@/components/dashboard/ChangesPanel'
import { DashboardFilters } from '@/components/dashboard/DashboardFilters'
import { KpiRow } from '@/components/dashboard/KpiRow'
import { TopTitlesTable } from '@/components/dashboard/TopTitlesTable'
import { Skeleton } from '@/components/ui/skeleton'
import { compact, hours, monthRange, percent } from '@/lib/format'
import { useUrlState } from '@/lib/url-state'

const FILTER_KEYS = ['start', 'end', 'countries', 'platforms', 'genres', 'distributors'] as const

function ShareCard({
  title,
  query,
  dimension,
}: {
  title: string
  query: DashboardQuery
  dimension: Schemas['BreakdownDimension']
}) {
  const breakdown = useDashboardBreakdown(query, dimension)
  return (
    <Panel title={title}>
      {breakdown.isError ? (
        <ErrorState error={breakdown.error} onRetry={() => breakdown.refetch()} />
      ) : !breakdown.data ? (
        <Skeleton className="h-40" />
      ) : breakdown.data.items.length === 0 ? (
        <EmptyState message="No streams for these filters." />
      ) : (
        <BarList
          label={title}
          format={percent}
          items={breakdown.data.items.map((item) => ({
            key: item.key,
            label:
              dimension === 'country' ? (
                <CountryLabel country={item.label} />
              ) : (
                <PlatformLabel platform={item.label} />
              ),
            value: item.share_of_streams,
            detail: compact(item.streams),
          }))}
        />
      )}
    </Panel>
  )
}

function EfficiencyCard({
  title,
  query,
  dimension,
}: {
  title: string
  query: DashboardQuery
  dimension: Schemas['BreakdownDimension']
}) {
  const breakdown = useDashboardBreakdown(query, dimension)
  const items = (breakdown.data?.items ?? [])
    .filter((item) => item.streams_per_title !== null)
    .sort((a, b) => (b.streams_per_title ?? 0) - (a.streams_per_title ?? 0))
    .slice(0, 10)
  return (
    <Panel title={title} aside={<span className="text-xs text-subtle">Streams per title</span>}>
      {breakdown.isError ? (
        <ErrorState error={breakdown.error} onRetry={() => breakdown.refetch()} />
      ) : !breakdown.data ? (
        <Skeleton className="h-64" />
      ) : items.length === 0 ? (
        <EmptyState
          message={
            dimension === 'theme'
              ? 'Themes have not been generated yet (make themes).'
              : 'No streams for these filters.'
          }
        />
      ) : (
        <BarList
          label={title}
          format={compact}
          items={items.map((item) => ({
            key: item.key,
            label: dimension === 'primary_genre' ? <GenreLabel genre={item.label} /> : item.label,
            value: item.streams_per_title ?? 0,
            detail: `${item.titles} titles`,
          }))}
        />
      )}
    </Panel>
  )
}

export function DashboardPage() {
  const { get, getList, update } = useUrlState()
  const options = useFilterOptions()
  const query: DashboardQuery = useMemo(
    () => ({
      start: get('start'),
      end: get('end'),
      countries: getList('countries'),
      platforms: getList('platforms'),
      genres: getList('genres'),
      distributors: getList('distributors'),
    }),
    [get, getList],
  )
  const metric = get('metric') === 'hours' ? 'hours' : 'streams'
  const sort = (get('sort') ?? 'streams') as Schemas['TitleSort']

  const summary = useDashboardSummary(query)
  const trend = useDashboardTrend(query)
  const matrix = useDashboardMatrix(query)
  const titles = useDashboardTitles(query, sort)
  const changes = useDashboardChanges(query)
  const period = summary.data?.filters ?? { start: query.start ?? '', end: query.end ?? '' }

  return (
    <div className="space-y-6 pt-2">
      <header>
        <p className="text-sm font-bold text-subtle">Dashboard</p>
        <h1 className="mt-1 text-4xl font-black tracking-tight max-sm:text-3xl">
          Catalog <span className="text-brand">performance</span>
        </h1>
        <p className="mt-2 text-subtle">
          {monthRange(period.start, period.end)} · streaming consumption in Argentina, Brazil,
          Colombia and Mexico
        </p>
      </header>

      {options.data && summary.data && (
        <DashboardFilters
          options={options.data}
          query={query}
          period={summary.data.filters}
          onChange={(changes) => update(changes)}
          onReset={() => update(Object.fromEntries(FILTER_KEYS.map((key) => [key, undefined])))}
        />
      )}

      {summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
      ) : (
        <KpiRow summary={summary.data} />
      )}

      <Panel
        title={metric === 'hours' ? 'Viewing hours per month' : 'Streams per month'}
        aside={
          <div className="flex gap-2">
            <Pill active={metric === 'streams'} onClick={() => update({ metric: undefined })}>
              Streams
            </Pill>
            <Pill active={metric === 'hours'} onClick={() => update({ metric: 'hours' })}>
              Hours
            </Pill>
          </div>
        }
      >
        {trend.isError ? (
          <ErrorState error={trend.error} onRetry={() => trend.refetch()} />
        ) : !trend.data ? (
          <Skeleton className="h-[280px]" />
        ) : (
          <TrendChart
            metricLabel={metric === 'hours' ? 'Viewing hours' : 'Streams'}
            format={metric === 'hours' ? hours : compact}
            points={trend.data.series.map((point) => ({
              month: point.month,
              value: metric === 'hours' ? point.viewing_hours : point.streams,
            }))}
          />
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <ShareCard title="Share of streams by platform" query={query} dimension="platform" />
        <ShareCard title="Share of streams by country" query={query} dimension="country" />
      </div>

      <Panel title="Streams per title, platform × country">
        {matrix.isError ? (
          <ErrorState error={matrix.error} onRetry={() => matrix.refetch()} />
        ) : !matrix.data ? (
          <Skeleton className="h-56" />
        ) : matrix.data.cells.length === 0 ? (
          <EmptyState message="No streams for these filters." />
        ) : (
          <MatrixGrid matrix={matrix.data} />
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <EfficiencyCard title="Genres" query={query} dimension="primary_genre" />
        <EfficiencyCard title="Themes" query={query} dimension="theme" />
      </div>

      <Panel
        title="Top titles"
        aside={
          titles.data && (
            <span className="text-xs text-subtle">{titles.data.pages[0].total} titles</span>
          )
        }
      >
        {titles.isError ? (
          <ErrorState error={titles.error} onRetry={() => titles.refetch()} />
        ) : !titles.data ? (
          <Skeleton className="h-96" />
        ) : titles.data.pages[0].total === 0 ? (
          <EmptyState message="No titles were streamed with these filters." />
        ) : (
          <>
            <TopTitlesTable
              items={titles.data.pages.flatMap((page) => page.items)}
              sort={sort}
              onSort={(next) => update({ sort: next === 'streams' ? undefined : next })}
            />
            {titles.hasNextPage && (
              <button
                type="button"
                onClick={() => titles.fetchNextPage()}
                disabled={titles.isFetchingNextPage}
                className="mt-4 text-sm font-bold text-subtle hover:text-white"
              >
                {titles.isFetchingNextPage ? 'Loading…' : 'Show more'}
              </button>
            )}
          </>
        )}
      </Panel>

      {changes.isError ? (
        <ErrorState error={changes.error} onRetry={() => changes.refetch()} />
      ) : changes.data ? (
        <ChangesPanel changes={changes.data} />
      ) : (
        <Skeleton className="h-48" />
      )}
    </div>
  )
}
