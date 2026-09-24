import { useDashboardBreakdown, useFilterOptions, type DashboardQuery } from '@/api/queries'
import { CountryLabel, GenreLabel, PlatformLabel } from '@/components/common/Brand'
import { SelectPill } from '@/components/common/SelectPill'
import { ErrorState, Panel } from '@/components/common/States'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'
import { compact, monthRange, signedPercent } from '@/lib/format'
import { shiftMonth } from '@/lib/months'
import { useUrlState } from '@/lib/url-state'

const ALL = 'All'
const MIN_TITLES = 5

type Row = {
  genre: string
  now: number | null
  before: number | null
  change: number | null
  few: boolean
}

export function GenresTab() {
  const { get, update } = useUrlState()
  const options = useFilterOptions()
  const country = get('country')
  const platform = get('platform')
  const last = options.data?.consumption_months.end ?? '2026-06'
  const base = {
    countries: country ? [country] : [],
    platforms: platform ? [platform] : [],
    genres: [],
    distributors: [],
  }
  const current: DashboardQuery = { ...base, start: shiftMonth(last, -11), end: last }
  const previous: DashboardQuery = {
    ...base,
    start: shiftMonth(last, -23),
    end: shiftMonth(last, -12),
  }
  const now = useDashboardBreakdown(current, 'primary_genre')
  const before = useDashboardBreakdown(previous, 'primary_genre')

  const beforeByGenre = new Map(before.data?.items.map((item) => [item.key, item]))
  const rows: Row[] = (now.data?.items ?? []).map((item) => {
    const earlier = beforeByGenre.get(item.key)
    const nowValue = item.streams_per_title
    const beforeValue = earlier?.streams_per_title ?? null
    return {
      genre: item.key,
      now: nowValue,
      before: beforeValue,
      change: nowValue !== null && beforeValue ? (nowValue - beforeValue) / beforeValue : null,
      few: item.titles < MIN_TITLES || (earlier?.titles ?? 0) < MIN_TITLES,
    }
  })
  rows.sort(
    (a, b) => Number(a.few) - Number(b.few) || (b.change ?? -Infinity) - (a.change ?? -Infinity),
  )

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-raised p-5">
        <p className="mb-3 text-sm text-subtle">
          Streams per title by primary genre, last 12 months vs the 12 before. Per title, so a genre
          does not rise just because more of its movies were added.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-2xl font-bold max-sm:text-lg">
          <span>Which genres are gaining in</span>
          <SelectPill
            size="lg"
            label="Country"
            value={country ?? ALL}
            options={[ALL, ...(options.data?.consumption.countries ?? [])]}
            renderOption={(value) =>
              value === ALL ? 'all countries' : <CountryLabel country={value} />
            }
            onChange={(value) => update({ country: value === ALL ? undefined : value })}
          />
          <span>on</span>
          <SelectPill
            size="lg"
            label="Platform"
            value={platform ?? ALL}
            options={[ALL, ...(options.data?.consumption.platforms ?? [])]}
            renderOption={(value) =>
              value === ALL ? 'all platforms' : <PlatformLabel platform={value} />
            }
            onChange={(value) => update({ platform: value === ALL ? undefined : value })}
          />
          <span>?</span>
        </div>
      </div>

      {now.isError || before.isError ? (
        <ErrorState
          error={now.error ?? before.error}
          onRetry={() => (now.refetch(), before.refetch())}
        />
      ) : !now.data || !before.data ? (
        <Skeleton className="h-96" />
      ) : (
        <Panel
          title="Genre momentum"
          aside={
            <span className="text-xs text-subtle">
              {monthRange(current.start, current.end)} vs {monthRange(previous.start, previous.end)}
            </span>
          }
        >
          <table className="w-full text-sm">
            <thead className="border-b text-left text-subtle">
              <tr>
                <th scope="col" className="py-2 font-normal">
                  Genre
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Streams per title now
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  12 months before
                </th>
                <th scope="col" className="py-2 text-right font-normal">
                  Change
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.genre}
                  className={cn(
                    'border-b border-white/5 last:border-none',
                    row.few && 'text-subtle',
                  )}
                >
                  <td className="py-2.5">
                    <GenreLabel genre={row.genre} />
                    {row.few && <span className="ml-2 text-xs">few titles</span>}
                  </td>
                  <td className="py-2.5 text-right tabular">{compact(row.now)}</td>
                  <td className="py-2.5 text-right tabular">{compact(row.before)}</td>
                  <td
                    className={cn(
                      'py-2.5 text-right font-bold tabular',
                      !row.few &&
                        row.change !== null &&
                        (row.change >= 0 ? 'text-positive' : 'text-negative'),
                    )}
                  >
                    {signedPercent(row.change)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  )
}
