import { Plus, X } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router'
import { ApiError, type Schemas } from '@/api/client'
import { useComparedTitles, useFilterOptions } from '@/api/queries'
import { TrendChart } from '@/components/charts/TrendChart'
import { CountryLabel, PlatformIcon, PlatformLabel } from '@/components/common/Brand'
import { GenreLink } from '@/components/common/CategoryLink'
import { MultiSelectPill } from '@/components/common/MultiSelectPill'
import { Pill } from '@/components/common/Pill'
import { Poster } from '@/components/common/Poster'
import { EmptyState, Panel } from '@/components/common/States'
import { TitlePicker } from './TitlePicker'
import { Skeleton } from '@/components/ui/skeleton'
import { alignSeries, peak, topIndex, type Align } from '@/lib/compare'
import { compact, hours, monthLabel, percent, rating, runtime } from '@/lib/format'
import { useUrlState } from '@/lib/url-state'

const MAX_TITLES = 3
const COLORS = ['#ff6fcf', '#ffffff', '#7dd3fc']
const TITLE_ID = /^tt\d{7,9}$/

type Column = {
  titleId: string
  color: string
  movie: Schemas['MovieDetail'] | undefined
  missing: boolean
  availability: Schemas['Availability'] | undefined
  performance: Schemas['Performance'] | undefined
}

// One row of the comparison: a caption and one cell per title, so every value sits level with its
// counterparts in the other columns.
function Row({
  label,
  columns,
  cell,
  top,
  pad,
}: {
  label: string
  columns: Column[]
  cell: (column: Column) => ReactNode
  top?: number | null
  pad: boolean
}) {
  return (
    <>
      {columns.map((column, index) => (
        <div key={column.titleId} className="border-t border-white/5 px-3 py-3">
          <p className="flex items-center gap-2 text-xs text-subtle">
            {label}
            {top === index && (
              <span className="rounded-full bg-pink px-1.5 py-px text-[10px] font-bold text-black">
                Top
              </span>
            )}
          </p>
          <div className="mt-1 min-h-6">
            {column.missing ? (
              <span className="text-subtle">—</span>
            ) : column.movie && column.performance ? (
              cell(column)
            ) : (
              <Skeleton className="h-5 w-24" />
            )}
          </div>
        </div>
      ))}
      {/* The add slot has no values; an empty cell keeps the grid's rows aligned. */}
      {pad && <div className="border-t border-white/5" />}
    </>
  )
}

function ColumnHeader({ column, onRemove }: { column: Column; onRemove: () => void }) {
  const { movie } = column
  return (
    <div className="px-3 pb-3">
      <div className="relative max-w-56">
        {column.missing ? (
          <div className="grid aspect-[2/3] place-items-center rounded-lg bg-raised p-4 text-center text-sm text-subtle">
            Title not found
          </div>
        ) : !movie ? (
          <Skeleton className="aspect-[2/3] w-full rounded-lg" />
        ) : (
          <Link to={`/movies/${movie.title_id}`} className="block">
            <Poster
              src={movie.image_url}
              title={movie.title}
              className="aspect-[2/3] w-full rounded-lg shadow-xl shadow-black/50"
            />
          </Link>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${movie?.title ?? 'this title'} from the comparison`}
          className="pressable absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/70 text-white backdrop-blur-sm hover:bg-black"
        >
          <X className="size-4" />
        </button>
      </div>
      {!movie && !column.missing && <Skeleton className="mt-3 h-6 w-3/4" />}
      {movie && (
        <div className="mt-3 flex items-start gap-2">
          <span
            className="mt-2 h-1 w-4 shrink-0 rounded-full"
            style={{ background: column.color }}
            aria-hidden
          />
          <div className="min-w-0">
            <Link
              to={`/movies/${movie.title_id}`}
              className="line-clamp-2 text-lg font-bold leading-tight hover:underline"
            >
              {movie.title}
            </Link>
            <p className="mt-1 flex flex-wrap gap-x-2 text-sm text-subtle">
              <span>{movie.year}</span>
              {movie.genres.slice(0, 2).map((genre) => (
                <GenreLink key={genre} genre={genre} icon={false} />
              ))}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function AddSlot({ exclude, onAdd }: { exclude: string[]; onAdd: (titleId: string) => void }) {
  return (
    <div className="px-3 pb-3">
      <div className="max-w-56">
        {/* Above the box, so its results open over the empty space instead of off screen. */}
        <TitlePicker
          selected={undefined}
          exclude={exclude}
          onSelect={(movie) => onAdd(movie.title_id)}
          className="w-full"
        />
        <div className="mt-3 grid aspect-[2/3] place-items-center rounded-lg border border-dashed border-white/20 p-4 text-center">
          <div>
            <Plus className="mx-auto size-6 text-subtle" />
            <p className="mt-2 text-sm font-bold">Add a title</p>
            <p className="mt-1 text-xs text-subtle">Compare up to {MAX_TITLES} side by side.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CompareTab() {
  const { get, getList, update } = useUrlState()
  const titleIds = [
    ...new Set(
      (get('titles') ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => TITLE_ID.test(id)),
    ),
  ].slice(0, MAX_TITLES)
  const countries = getList('countries')
  const platforms = getList('platforms')
  const metric = get('metric') === 'hours' ? 'hours' : 'streams'
  const align: Align = get('align') === 'launch' ? 'launch' : 'calendar'
  const options = useFilterOptions()
  const data = useComparedTitles(titleIds, countries, platforms)

  const value = (point: Schemas['MonthlyPoint']) =>
    metric === 'hours' ? point.viewing_hours : point.streams
  const format = metric === 'hours' ? hours : compact

  const columns: Column[] = titleIds.map((titleId, index) => ({
    titleId,
    color: COLORS[index],
    movie: data.movies[index]?.data,
    missing:
      data.movies[index]?.error instanceof ApiError && data.movies[index].error.status === 404,
    availability: data.availability[index]?.data,
    performance: data.performance[index]?.data,
  }))

  const setTitles = (next: string[]) => update({ titles: next.join(',') || undefined })
  const slots = columns.length + (columns.length < MAX_TITLES ? 1 : 0)

  // A title that does not exist never loads, so it must not hold the chart back.
  const chartReady =
    columns.length > 0 &&
    columns.every((column) => column.missing || (column.performance && column.movie))
  const aligned = alignSeries(
    columns.map((column) => column.performance?.series ?? []),
    value,
    align,
  )

  const totals = columns.map((column) =>
    column.performance
      ? metric === 'hours'
        ? column.performance.totals.viewing_hours
        : column.performance.totals.streams
      : null,
  )
  const monthsWithData = columns.map(
    (column) => column.performance?.series.filter((point) => point.streams > 0).length ?? null,
  )

  return (
    <div className="space-y-6 pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <Pill active={metric === 'streams'} onClick={() => update({ metric: undefined })}>
          Streams
        </Pill>
        <Pill active={metric === 'hours'} onClick={() => update({ metric: 'hours' })}>
          Viewing hours
        </Pill>
        <span className="mx-1 h-5 w-px bg-white/15" aria-hidden />
        <MultiSelectPill
          label="Countries"
          renderOption={(country) => <CountryLabel country={country} />}
          options={options.data?.consumption.countries ?? []}
          selected={countries}
          onChange={(next) => update({ countries: next })}
        />
        <MultiSelectPill
          label="Platforms"
          renderOption={(platform) => <PlatformLabel platform={platform} />}
          options={options.data?.consumption.platforms ?? []}
          selected={platforms}
          onChange={(next) => update({ platforms: next })}
        />
        <span className="mx-1 h-5 w-px bg-white/15" aria-hidden />
        <Pill active={align === 'calendar'} onClick={() => update({ align: undefined })}>
          Calendar
        </Pill>
        <Pill active={align === 'launch'} onClick={() => update({ align: 'launch' })}>
          From launch
        </Pill>
      </div>

      {columns.length > 0 && (
        <Panel>
          {!chartReady ? (
            <Skeleton className="h-72" />
          ) : aligned.keys.length === 0 ? (
            <EmptyState message="No consumption in these filters for any of these titles." />
          ) : (
            <TrendChart
              metricLabel={metric === 'hours' ? 'Viewing hours' : 'Streams'}
              format={format}
              unit={metric === 'hours' ? ' h' : ''}
              months={aligned.keys}
              xLabel={
                align === 'launch'
                  ? { short: (key) => `M${key}`, long: (key) => `Month ${key} from launch` }
                  : undefined
              }
              series={columns.flatMap((column, index) =>
                column.movie
                  ? [
                      {
                        key: column.titleId,
                        name: column.movie.title,
                        label: column.movie.title,
                        color: column.color,
                        values: aligned.values[index],
                      },
                    ]
                  : [],
              )}
            />
          )}
          {align === 'launch' && chartReady && (
            <p className="mt-3 text-xs text-subtle">
              Month 1 is each title's first month with consumption in these filters.
            </p>
          )}
        </Panel>
      )}

      {/* Columns share one grid, so each row lines up across titles; on phones the grid swipes
          sideways with the next column peeking in. */}
      <div className="-mx-3 overflow-x-auto scrollbar-none max-sm:snap-x max-sm:snap-mandatory">
        <div
          style={{ '--slots': slots } as CSSProperties}
          className="grid [grid-template-columns:repeat(var(--slots),minmax(0,1fr))] max-sm:[grid-template-columns:repeat(var(--slots),80%)] max-sm:[&>*]:snap-start"
        >
          {columns.map((column) => (
            <ColumnHeader
              key={column.titleId}
              column={column}
              onRemove={() => setTitles(titleIds.filter((id) => id !== column.titleId))}
            />
          ))}
          {slots > columns.length && (
            <AddSlot exclude={titleIds} onAdd={(titleId) => setTitles([...titleIds, titleId])} />
          )}

          {columns.length > 0 && (
            <CompareRows
              columns={columns}
              padSlot={slots > columns.length}
              totals={totals}
              monthsWithData={monthsWithData}
              metric={metric}
              value={value}
              format={format}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function CompareRows({
  columns,
  padSlot,
  totals,
  monthsWithData,
  metric,
  value,
  format,
}: {
  columns: Column[]
  padSlot: boolean
  totals: (number | null)[]
  monthsWithData: (number | null)[]
  metric: 'streams' | 'hours'
  value: (point: Schemas['MonthlyPoint']) => number
  format: (value: number) => string
}) {
  const noConsumption = (column: Column) => column.performance?.series.length === 0
  const none = <span className="text-subtle">No consumption in these filters</span>
  const rows: { label: string; cell: (column: Column) => ReactNode; top?: number | null }[] = [
    {
      label: 'Rating',
      top: topIndex(columns.map((column) => column.movie?.rating)),
      cell: ({ movie }) => (
        <span className="tabular">
          <span className="font-bold">{rating(movie!.rating)}</span>
          <span className="text-subtle"> · {compact(movie!.vote_count)} votes</span>
        </span>
      ),
    },
    {
      label: 'Runtime',
      cell: ({ movie }) => <span className="tabular">{runtime(movie!.runtime_minutes)}</span>,
    },
    {
      label: 'Directed by',
      cell: ({ movie }) => <span>{movie!.directors.join(', ') || '—'}</span>,
    },
    {
      label: metric === 'hours' ? 'Viewing hours' : 'Streams',
      top: topIndex(totals),
      cell: (column) =>
        noConsumption(column) ? (
          none
        ) : (
          <span className="text-2xl font-bold tabular">
            {format(
              metric === 'hours'
                ? column.performance!.totals.viewing_hours
                : column.performance!.totals.streams,
            )}
          </span>
        ),
    },
    {
      label: 'Months with consumption',
      top: topIndex(monthsWithData),
      cell: (column) =>
        noConsumption(column) ? (
          none
        ) : (
          <span className="tabular">
            {column.performance!.series.filter((point) => point.streams > 0).length}
          </span>
        ),
    },
    {
      label: 'Peak month',
      cell: (column) => {
        const best = peak(column.performance!.series, value)
        return best ? (
          <span className="tabular">
            {monthLabel(best.month)} <span className="text-subtle">· {format(value(best))}</span>
          </span>
        ) : (
          none
        )
      },
    },
    {
      label: 'Top country',
      cell: (column) => {
        const first = column.performance!.by_country[0]
        return first ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            <CountryLabel country={first.key} />
            <span className="text-subtle tabular">{percent(first.share_of_streams)}</span>
          </span>
        ) : (
          none
        )
      },
    },
    {
      label: 'Top platform',
      cell: (column) => {
        const first = column.performance!.by_platform[0]
        return first ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            <PlatformLabel platform={first.key} />
            <span className="text-subtle tabular">{percent(first.share_of_streams)}</span>
          </span>
        ) : (
          none
        )
      },
    },
    {
      label: 'Available in',
      cell: ({ availability }) =>
        !availability ? (
          <Skeleton className="h-5 w-24" />
        ) : availability.offers.length === 0 ? (
          <span className="text-subtle">No availability in the snapshot</span>
        ) : (
          <span className="flex flex-wrap items-center gap-2">
            <span className="tabular">
              {availability.countries.length}{' '}
              {availability.countries.length === 1 ? 'country' : 'countries'}
            </span>
            <span className="flex flex-wrap gap-1">
              {availability.offers.map((offer) => (
                <PlatformIcon key={offer.platform} platform={offer.platform} />
              ))}
            </span>
          </span>
        ),
    },
  ]
  return (
    <>
      {rows.map((row) => (
        <Row
          key={row.label}
          label={row.label}
          columns={columns}
          cell={row.cell}
          top={row.top}
          pad={padSlot}
        />
      ))}
    </>
  )
}
