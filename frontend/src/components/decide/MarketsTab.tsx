import { Link } from 'react-router'
import { ApiError } from '@/api/client'
import { useMarketOpportunities, useMovie } from '@/api/queries'
import { CountryLabel, PlatformLabel } from '@/components/common/Brand'
import { EmptyState, ErrorState, Panel } from '@/components/common/States'
import { Skeleton } from '@/components/ui/skeleton'
import { compact } from '@/lib/format'
import { useUrlState } from '@/lib/url-state'
import { SignalBadge } from './SignalBadge'
import { TitlePicker } from './TitlePicker'

export function MarketsTab() {
  const { get, update } = useUrlState()
  const titleId = get('title') ?? ''
  const movie = useMovie(titleId)
  const markets = useMarketOpportunities(titleId)
  const data = markets.data

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-raised p-5">
        <p className="mb-3 text-sm text-subtle">
          Every platform and country with consumption data, ranked by how similar titles did there
          compared with a typical title.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-2xl font-bold max-sm:text-lg">
          <span>Where should</span>
          <TitlePicker
            selected={titleId ? movie.data : undefined}
            onSelect={(picked) => update({ title: picked.title_id })}
          />
          <span>go next?</span>
        </div>
      </div>

      {!titleId ? (
        <EmptyState message="Pick a title to rank the markets." />
      ) : markets.error instanceof ApiError && markets.error.status === 404 ? (
        <EmptyState message="This title is not in the catalog. Pick another one above." />
      ) : markets.isError ? (
        <ErrorState error={markets.error} onRetry={() => markets.refetch()} />
      ) : !data ? (
        <Skeleton className="h-96" />
      ) : (
        <Panel
          title={`Best markets for ${data.movie.title}`}
          aside={
            <span className="text-xs text-subtle">
              Based on {data.comparable_count} comparable titles
            </span>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b text-left text-subtle">
                <tr>
                  <th scope="col" className="py-2 font-normal">
                    #
                  </th>
                  <th scope="col" className="py-2 font-normal">
                    Platform
                  </th>
                  <th scope="col" className="py-2 font-normal">
                    Country
                  </th>
                  <th scope="col" className="py-2 font-normal">
                    Signal
                  </th>
                  <th scope="col" className="py-2 text-right font-normal">
                    Comparables' median
                  </th>
                  <th scope="col" className="py-2 text-right font-normal">
                    Typical title
                  </th>
                  <th scope="col" className="py-2 text-right font-normal">
                    Ratio
                  </th>
                  <th scope="col" className="py-2 font-normal" />
                </tr>
              </thead>
              <tbody>
                {data.targets.map((target, index) => (
                  <tr
                    key={`${target.platform}-${target.country}`}
                    className="border-b border-white/5 last:border-none"
                  >
                    <td className="py-2.5 text-subtle tabular">{index + 1}</td>
                    <td className="py-2.5">
                      <PlatformLabel platform={target.platform} />
                    </td>
                    <td className="py-2.5">
                      <CountryLabel country={target.country} />
                    </td>
                    <td className="py-2.5">
                      <SignalBadge signal={target.signal} compact />
                    </td>
                    <td className="py-2.5 text-right tabular">{compact(target.median)}</td>
                    <td className="py-2.5 text-right tabular text-subtle">
                      {compact(target.benchmark)}
                    </td>
                    <td className="py-2.5 text-right font-bold tabular">
                      {target.ratio === null ? '—' : `${target.ratio.toFixed(1)}×`}
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      {target.already_available ? (
                        <span className="rounded-full bg-pill px-2 py-0.5 text-xs text-subtle">
                          Already available
                        </span>
                      ) : (
                        <Link
                          to={`/decide?tab=licensing&title=${data.movie.title_id}&platform=${encodeURIComponent(target.platform)}&country=${encodeURIComponent(target.country)}`}
                          className="text-xs font-bold text-pink hover:underline"
                        >
                          Assess
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-subtle">
            Median and typical title are streams in the first 6 months on that platform and country.
            Ratio = comparables' median ÷ typical title.
          </p>
        </Panel>
      )}
    </div>
  )
}
