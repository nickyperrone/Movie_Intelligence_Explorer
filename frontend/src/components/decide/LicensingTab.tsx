import { CountryFlag, PlatformLabel } from '@/components/common/Brand'
import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router'
import { useFilterOptions, useLicensing, useLicensingMemo, useMovie } from '@/api/queries'
import { BarList } from '@/components/charts/BarList'
import { Poster } from '@/components/common/Poster'
import { EmptyState, ErrorState, Panel } from '@/components/common/States'
import { Skeleton } from '@/components/ui/skeleton'
import { compact, hours } from '@/lib/format'
import { useUrlState } from '@/lib/url-state'
import { ExpectedRangeChart } from './ExpectedRangeChart'
import { MemoPanel } from './MemoPanel'
import { SignalBadge } from './SignalBadge'
import { TitlePicker } from './TitlePicker'

function TargetSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="text-xs text-subtle">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block h-11 rounded-full bg-pill px-4 text-sm text-white outline-none focus:ring-2 focus:ring-white"
      >
        <option value="">Choose</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
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
      <p className="max-w-3xl text-subtle">
        Should we license this title to this platform in this country? The evidence comes from
        comparable titles: same primary genre, released within two years, closest by plot.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <TitlePicker
          selected={titleId ? movie.data : undefined}
          onSelect={(picked) => update({ title: picked.title_id })}
        />
        <TargetSelect
          label="Platform"
          value={platform}
          options={options.data?.consumption.platforms ?? []}
          onChange={(value) => update({ platform: value })}
        />
        <TargetSelect
          label="Country"
          value={country}
          options={options.data?.consumption.countries ?? []}
          onChange={(value) => update({ country: value })}
        />
      </div>

      {!query ? (
        <EmptyState message="Choose a title, a platform and a country to see the evidence." />
      ) : assessment.isError ? (
        <ErrorState error={assessment.error} onRetry={() => assessment.refetch()} />
      ) : !data ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4 rounded-lg bg-raised p-5">
            <Poster
              src={data.movie.image_url}
              title={data.movie.title}
              className="h-24 w-16 rounded-md"
            />
            <div className="min-w-0 flex-1">
              <Link
                to={`/movies/${data.movie.title_id}`}
                className="text-2xl font-black tracking-tight hover:underline"
              >
                {data.movie.title}
              </Link>
              <p className="text-sm text-subtle">
                {data.movie.year} · {data.movie.primary_genre} · to {data.target.platform} in{' '}
                {data.target.country}
              </p>
              <p className="mt-1 text-sm text-subtle">
                Its own consumption, all markets: {compact(data.title_totals.streams)} streams,{' '}
                {hours(data.title_totals.viewing_hours)}. Available in:{' '}
                {data.availability_countries.join(', ') || 'no tracked country'}.
              </p>
            </div>
            <SignalBadge signal={data.signal} />
          </div>

          {data.already_on_target && (
            <p className="flex items-center gap-2 rounded-lg bg-warning/15 px-4 py-3 text-sm text-warning">
              <AlertTriangle className="size-4 shrink-0" />
              This title is already available on {data.target.platform} in {data.target.country}{' '}
              (Jun 2026 snapshot).
            </p>
          )}

          <Panel
            title="Expected first 6 months on the target"
            aside={
              <span className="text-xs text-subtle">
                {data.expected_range.eligible_count} comparables with a full window
              </span>
            }
          >
            {data.expected_range.status === 'ok' ? (
              <ExpectedRangeChart range={data.expected_range} comparables={data.comparables} />
            ) : (
              <p className="text-sm text-subtle">
                Fewer than 3 comparable titles streamed on {data.target.platform} in{' '}
                {data.target.country} with a full 6-month window, so no range is shown.
              </p>
            )}
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel
              title={`Platform fit in ${data.target.country}`}
              aside={<span className="text-xs text-subtle">Streams per title</span>}
            >
              {data.platform_fit.length === 0 ? (
                <p className="text-sm text-subtle">No comparable has streams in this country.</p>
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
            <Panel title="Whitespace">
              {data.whitespace.length === 0 ? (
                <p className="text-sm text-subtle">
                  No country where comparables stream and this title is missing.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.whitespace.map((item) => (
                    <li key={item.country} className="flex justify-between">
                      <span className="inline-flex items-center gap-2">
                        <CountryFlag country={item.country} /> Not available in {item.country}
                      </span>
                      <span className="text-subtle">
                        {item.comparables_with_streams} comparables stream there
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
                          className="hover:underline"
                        >
                          {comparable.movie.title}
                        </Link>
                        <span className="ml-2 text-xs text-subtle">{comparable.movie.year}</span>
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
