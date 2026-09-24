import { CountryLabel, GenreLabel, PlatformLabel } from '@/components/common/Brand'
import { useMemo, useState } from 'react'
import type { Schemas } from '@/api/client'
import {
  useDashboardBreakdown,
  useDashboardChanges,
  useDashboardMatrix,
  useDashboardSummary,
  useDashboardTitles,
  useFilterOptions,
  type DashboardQuery,
} from '@/api/queries'
import { BarList } from '@/components/charts/BarList'
import { MatrixGrid } from '@/components/charts/MatrixGrid'
import { SourceNote } from '@/components/common/SourceNote'
import { EmptyState, ErrorState, Panel } from '@/components/common/States'
import { ChangesPanel } from '@/components/dashboard/ChangesPanel'
import { DashboardToolbar } from '@/components/dashboard/DashboardToolbar'
import { KpiDetail } from '@/components/dashboard/KpiDetail'
import { KpiRow } from '@/components/dashboard/KpiRow'
import type { KpiKey } from '@/components/dashboard/kpis'
import { SOURCES } from '@/components/dashboard/sources'
import { TrendPanel, type Compare } from '@/components/dashboard/TrendPanel'
import { TopTitlesTable } from '@/components/dashboard/TopTitlesTable'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'
import { compact, monthRange, percent } from '@/lib/format'
import { useUrlState } from '@/lib/url-state'

const FILTER_KEYS = [
  'start',
  'end',
  'countries',
  'platforms',
  'genres',
  'themes',
  'distributors',
] as const

function ShareCard({
  title,
  query,
  dimension,
  onSelect,
}: {
  title: string
  query: DashboardQuery
  dimension: Schemas['BreakdownDimension']
  onSelect: (key: string) => void
}) {
  const breakdown = useDashboardBreakdown(query, dimension)
  return (
    <Panel
      title={title}
      aside={<SourceNote>{SOURCES.shares}</SourceNote>}
      refreshing={breakdown.isPlaceholderData}
    >
      {breakdown.isError ? (
        <ErrorState error={breakdown.error} onRetry={() => breakdown.refetch()} />
      ) : !breakdown.data ? (
        <Skeleton className="h-40" />
      ) : breakdown.data.items.length === 0 ? (
        <EmptyState message="No streams for these filters." />
      ) : (
        <BarList
          label={title}
          onSelect={onSelect}
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
  onSelect,
}: {
  title: string
  query: DashboardQuery
  dimension: Schemas['BreakdownDimension']
  onSelect: (key: string) => void
}) {
  const breakdown = useDashboardBreakdown(query, dimension)
  const items = (breakdown.data?.items ?? [])
    .filter((item) => item.streams_per_title !== null)
    .sort((a, b) => (b.streams_per_title ?? 0) - (a.streams_per_title ?? 0))
    .slice(0, 10)
  return (
    <Panel
      title={title}
      refreshing={breakdown.isPlaceholderData}
      aside={
        <span className="flex items-center gap-2 text-xs text-subtle">
          Streams per title
          <SourceNote>{dimension === 'theme' ? SOURCES.themes : SOURCES.genres}</SourceNote>
        </span>
      }
    >
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
          onSelect={onSelect}
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
      themes: getList('themes'),
      distributors: getList('distributors'),
    }),
    [get, getList],
  )
  const metric = get('metric') === 'hours' ? 'hours' : 'streams'
  const compare = (get('compare') ?? 'total') as Compare
  const [openKpi, setOpenKpi] = useState<KpiKey | null>(null)
  const sort = (get('sort') ?? 'streams') as Schemas['TitleSort']

  const summary = useDashboardSummary(query)
  const matrix = useDashboardMatrix(query)
  const titles = useDashboardTitles(query, sort)
  const changes = useDashboardChanges(query)
  const period = summary.data?.filters

  return (
    <div className="stagger-children space-y-6 pt-2">
      <header>
        <p className="text-sm font-bold text-subtle">Dashboard</p>
        <h1 className="mt-1 text-4xl font-black tracking-tight max-sm:text-3xl">
          Catalog <span className="text-brand">performance</span>
        </h1>
        <p className="mt-2 text-subtle">
          {period ? monthRange(period.start, period.end) : '…'} · streaming consumption in
          Argentina, Brazil, Colombia and Mexico
        </p>
      </header>

      {options.data && (
        <DashboardToolbar
          options={options.data}
          query={query}
          summary={summary.data}
          onChange={(changes) => update(changes)}
          onReset={() => update(Object.fromEntries(FILTER_KEYS.map((key) => [key, undefined])))}
        />
      )}

      {summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
      ) : (
        <div
          className={cn(
            'transition-opacity duration-200',
            summary.isPlaceholderData && 'opacity-60',
          )}
        >
          <KpiRow summary={summary.data} onOpen={setOpenKpi} />
        </div>
      )}

      <TrendPanel
        query={query}
        summary={summary.data}
        metric={metric}
        compare={compare}
        onMetric={(next) => update({ metric: next === 'streams' ? undefined : next })}
        onCompare={(next) => update({ compare: next === 'total' ? undefined : next })}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ShareCard
          title="Share of streams by platform"
          query={query}
          dimension="platform"
          onSelect={(key) => update({ platforms: [key] })}
        />
        <ShareCard
          title="Share of streams by country"
          query={query}
          dimension="country"
          onSelect={(key) => update({ countries: [key] })}
        />
      </div>

      <Panel
        refreshing={matrix.isPlaceholderData}
        title="Streams per title, platform × country"
        aside={<SourceNote>{SOURCES.matrix}</SourceNote>}
      >
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
        <EfficiencyCard
          title="Genres"
          query={query}
          dimension="primary_genre"
          onSelect={(key) => update({ genres: [key] })}
        />
        <EfficiencyCard
          title="Themes"
          query={query}
          dimension="theme"
          onSelect={(key) => update({ themes: [key] })}
        />
      </div>

      <Panel
        refreshing={titles.isPlaceholderData}
        title="Top titles"
        aside={
          <span className="flex items-center gap-2 text-xs text-subtle">
            {titles.data && `${titles.data.pages[0].total} titles`}
            <SourceNote>{SOURCES.titles}</SourceNote>
          </span>
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
        <ChangesPanel changes={changes.data} source={<SourceNote>{SOURCES.changes}</SourceNote>} />
      ) : (
        <Skeleton className="h-48" />
      )}
      {summary.data && (
        <KpiDetail
          kpiKey={openKpi}
          query={query}
          summary={summary.data}
          onClose={() => setOpenKpi(null)}
        />
      )}
    </div>
  )
}
