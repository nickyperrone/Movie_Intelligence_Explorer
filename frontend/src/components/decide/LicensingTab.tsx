import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router'
import { ApiError, type Schemas } from '@/api/client'
import { useFilterOptions, useLicensing, useLicensingMemo, useMovie } from '@/api/queries'
import { BarList } from '@/components/charts/BarList'
import { CountryFlag, CountryLabel, PlatformLabel } from '@/components/common/Brand'
import { Poster } from '@/components/common/Poster'
import { SelectPill } from '@/components/common/SelectPill'
import { EmptyState, ErrorState, Panel } from '@/components/common/States'
import { Skeleton } from '@/components/ui/skeleton'
import { compact, hours } from '@/lib/format'
import { useUrlState } from '@/lib/url-state'
import { ExpectedRangeChart } from './ExpectedRangeChart'
import { MemoPanel } from './MemoPanel'
import { SignalBadge } from './SignalBadge'
import { TitlePicker } from './TitlePicker'

const VERDICT_TITLE: Record<Schemas['DemandSignal'], string> = {
  strong: 'Similar titles did well here',
  moderate: 'Similar titles performed like a typical title here',
  weak: 'Similar titles underperformed here',
  insufficient_evidence: 'Not enough evidence to judge',
}

// The verdict sentence is built from the facts, not written by the LLM.
function verdictSentence(data: Schemas['LicensingAssessment']): string {
  const { expected_range: range, target } = data
  if (range.status !== 'ok' || range.median === null || !range.benchmark) {
    return `Fewer than 3 comparable titles streamed on ${target.platform} in ${target.country} for a full 6 months, so there is no reliable reference.`
  }
  const ratio = range.median / range.benchmark
  return `Comparable titles reached a median of ${compact(range.median)} streams in their first 6 months on ${target.platform} in ${target.country}, ${ratio.toFixed(1)}× the typical title there (${compact(range.benchmark)}).`
}

export function LicensingTab() {
  const { get, update } = useUrlState()
  const options = useFilterOptions()
  const titleId = get('title') ?? ''
  const platform = get('platform') ?? ''
  const country = get('country') ?? ''
  const movie = useMovie(titleId)
  const query = titleId && platform && country ? { title_id: titleId, platform, country } : null
  const assessment = useLicensing(query)
  const memo = useLicensingMemo(query, assessment.isSuccess)
  const data = assessment.data

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-raised p-5">
        <p className="mb-3 text-sm text-subtle">
          Should we license a title to a platform in a country? Build the question:
        </p>
        <div className="flex flex-wrap items-center gap-3 text-2xl font-bold max-sm:text-lg">
          <span>License</span>
          <TitlePicker
            selected={titleId ? movie.data : undefined}
            onSelect={(picked) => update({ title: picked.title_id })}
          />
          <span>to</span>
          <SelectPill
            size="lg"
            label="Platform"
            placeholder="platform"
            value={platform || undefined}
            options={options.data?.consumption.platforms ?? []}
            renderOption={(value) => <PlatformLabel platform={value} />}
            onChange={(value) => update({ platform: value })}
          />
          <span>in</span>
          <SelectPill
            size="lg"
            label="Country"
            placeholder="country"
            value={country || undefined}
            options={options.data?.consumption.countries ?? []}
            renderOption={(value) => <CountryLabel country={value} />}
            onChange={(value) => update({ country: value })}
          />
          <span>?</span>
        </div>
        <p className="mt-3 text-xs text-subtle">
          The evidence comes from comparable titles: same primary genre, released within two years,
          closest by plot.
        </p>
      </div>

      {!query ? (
        <EmptyState message="Pick a title, a platform and a country to see the evidence." />
      ) : assessment.error instanceof ApiError && assessment.error.status === 404 ? (
        <EmptyState message="This title is not in the catalog. Pick another one above." />
      ) : assessment.isError ? (
        <ErrorState error={assessment.error} onRetry={() => assessment.refetch()} />
      ) : !data ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="rounded-lg bg-gradient-to-br from-pink/20 to-raised p-6">
              <SignalBadge signal={data.signal} />
              <h2 className="mt-4 text-3xl font-black tracking-tight">
                {VERDICT_TITLE[data.signal]}
              </h2>
              <p className="mt-2 max-w-2xl text-lg leading-relaxed">{verdictSentence(data)}</p>
              {data.already_on_target && (
                <p className="mt-4 flex items-center gap-2 rounded-md bg-warning/15 px-3 py-2 text-sm text-warning">
                  <AlertTriangle className="size-4 shrink-0" />
                  This title is already available on {data.target.platform} in {data.target.country}{' '}
                  (Jun 2026 snapshot).
                </p>
              )}
            </div>
            <aside className="flex gap-4 rounded-lg bg-raised p-5">
              <Poster
                src={data.movie.image_url}
                title={data.movie.title}
                className="aspect-[2/3] w-20 shrink-0 rounded-md"
              />
              <div className="min-w-0 text-sm">
                <Link
                  to={`/movies/${data.movie.title_id}`}
                  className="text-lg font-bold hover:underline"
                >
                  {data.movie.title}
                </Link>
                <p className="text-subtle">
                  {data.movie.year} · {data.movie.primary_genre}
                </p>
                <p className="mt-3 text-subtle">Its own consumption, all markets</p>
                <p className="font-bold tabular">
                  {compact(data.title_totals.streams)} streams ·{' '}
                  {hours(data.title_totals.viewing_hours)}
                </p>
                <p className="mt-3 text-subtle">Available today in</p>
                <p className="flex flex-wrap gap-1.5">
                  {data.availability_countries.length
                    ? data.availability_countries.map((c) => <CountryFlag key={c} country={c} />)
                    : 'No tracked country'}
                </p>
              </div>
            </aside>
          </section>

          <Panel
            title="How similar titles did in their first 6 months"
            aside={
              <span className="text-xs text-subtle">
                on {data.target.platform} in {data.target.country} ·{' '}
                {data.expected_range.eligible_count} titles with 6 full months
              </span>
            }
          >
            {data.expected_range.status === 'ok' ? (
              <ExpectedRangeChart range={data.expected_range} comparables={data.comparables} />
            ) : (
              <p className="text-sm text-subtle">
                Fewer than 3 comparable titles streamed there for a full 6 months, so no range is
                shown.
              </p>
            )}
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel
              title={`Where similar titles perform in ${data.target.country}`}
              aside={<span className="text-xs text-subtle">Streams per title</span>}
            >
              {data.platform_fit.length === 0 ? (
                <p className="text-sm text-subtle">
                  No comparable title has streams in this country.
                </p>
              ) : (
                <BarList
                  label="Platform fit"
                  format={compact}
                  highlight={[data.target.platform]}
                  items={data.platform_fit.map((fit) => ({
                    key: fit.platform,
                    label: <PlatformLabel platform={fit.platform} />,
                    value: fit.streams_per_title ?? 0,
                    detail: `${fit.titles} titles`,
                  }))}
                />
              )}
            </Panel>
            <Panel title="Where it is missing">
              <p className="mb-3 text-sm text-subtle">
                Countries where similar titles are watched but this title is not available.
              </p>
              {data.whitespace.length === 0 ? (
                <p className="text-sm">
                  None: it is already available wherever similar titles are watched.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.whitespace.map((item) => (
                    <li key={item.country} className="flex justify-between">
                      <CountryLabel country={item.country} />
                      <span className="text-subtle">
                        {item.comparables_with_streams} similar titles watched there
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <Panel title="Comparable titles">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="border-b text-left text-subtle">
                  <tr>
                    <th scope="col" className="py-2 font-normal">
                      Title
                    </th>
                    <th scope="col" className="py-2 text-right font-normal">
                      Similarity
                    </th>
                    <th scope="col" className="py-2 text-right font-normal">
                      First 6 months on target
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.comparables.map((comparable) => (
                    <tr
                      key={comparable.movie.title_id}
                      className="border-b border-white/5 last:border-none"
                    >
                      <td className="py-2">
                        <Link
                          to={`/movies/${comparable.movie.title_id}`}
                          className="flex items-center gap-3 hover:underline"
                        >
                          <Poster
                            src={comparable.movie.image_url}
                            title={comparable.movie.title}
                            className="h-12 w-8 shrink-0 rounded-sm text-[9px]"
                          />
                          <span>
                            {comparable.movie.title}
                            <span className="ml-2 text-xs text-subtle">
                              {comparable.movie.year}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="py-2 text-right tabular">
                        {Math.round(comparable.similarity * 100)}%
                      </td>
                      <td className="py-2 text-right tabular">
                        {comparable.first_six_month_streams === null ? (
                          <span className="text-subtle">Never streamed there</span>
                        ) : comparable.eligible ? (
                          compact(comparable.first_six_month_streams)
                        ) : (
                          <span
                            className="text-subtle"
                            title="Its 6-month window is not complete yet, so it is excluded."
                          >
                            {compact(comparable.first_six_month_streams)} (partial)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <MemoPanel
            title={`Licensing ${data.movie.title} to ${data.target.platform} in ${data.target.country}`}
            status={memo.data?.status ?? (memo.isError ? 'failed' : undefined)}
            headline={memo.data?.headline}
            lists={[
              { title: 'Evidence', items: memo.data?.evidence ?? [] },
              { title: 'Risks', items: memo.data?.risks ?? [] },
            ]}
            caveats={memo.data?.caveats ?? []}
          />
        </>
      )}
    </div>
  )
}
