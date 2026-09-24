import { BarList } from '@/components/charts/BarList'
import { TrendChart } from '@/components/charts/TrendChart'
import { MultiSelectPill } from '@/components/common/MultiSelectPill'
import { Pill } from '@/components/common/Pill'
import { SectionHeader } from '@/components/common/SectionHeader'
import { EmptyState, ErrorState, Panel } from '@/components/common/States'
import { Skeleton } from '@/components/ui/skeleton'
import { usePerformance } from '@/api/queries'
import { compact, hours, monthRange, percent } from '@/lib/format'
import { useUrlState } from '@/lib/url-state'

export function PerformanceSection({ titleId }: { titleId: string }) {
  const { get, getList, update } = useUrlState()
  const countries = getList('countries')
  const platforms = getList('platforms')
  const metric = get('metric') === 'hours' ? 'hours' : 'streams'
  const performance = usePerformance(titleId, countries, platforms)
  const format = metric === 'hours' ? hours : compact
  const data = performance.data

  return (
    <section>
      <SectionHeader
        title="Performance"
        description="Monthly consumption in Argentina, Brazil, Colombia and Mexico on Amazon, Disney+, HBO Max and Netflix."
      />
      {performance.isError ? (
        <ErrorState error={performance.error} onRetry={() => performance.refetch()} />
      ) : !data ? (
        <Skeleton className="h-96" />
      ) : data.options.countries.length === 0 ? (
        <EmptyState message="No consumption recorded in Argentina, Brazil, Colombia or Mexico." />
      ) : (
        <div className="space-y-4">
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
              options={data.options.countries}
              selected={countries}
              onChange={(next) => update({ countries: next })}
            />
            <MultiSelectPill
              label="Platforms"
              options={data.options.platforms}
              selected={platforms}
              onChange={(next) => update({ platforms: next })}
            />
          </div>
          <Panel>
            <div className="mb-4 flex flex-wrap items-baseline gap-x-8 gap-y-2">
              <div>
                <p className="text-sm text-subtle">Streams</p>
                <p className="text-3xl font-bold tabular">{compact(data.totals.streams)}</p>
              </div>
              <div>
                <p className="text-sm text-subtle">Viewing hours</p>
                <p className="text-3xl font-bold tabular">{hours(data.totals.viewing_hours)}</p>
              </div>
              <p className="text-sm text-subtle">
                {data.period ? monthRange(data.period.start, data.period.end) : ''}
              </p>
            </div>
            {data.series.length === 0 ? (
              <EmptyState message="No consumption for this country and platform combination." />
            ) : (
              <TrendChart
                metricLabel={metric === 'hours' ? 'Viewing hours' : 'Streams'}
                format={format}
                points={data.series.map((point) => ({
                  month: point.month,
                  value: metric === 'hours' ? point.viewing_hours : point.streams,
                }))}
              />
            )}
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            {(
              [
                ['By country', data.by_country, countries],
                ['By platform', data.by_platform, platforms],
              ] as const
            ).map(([title, items, highlight]) => (
              <Panel key={title} title={title}>
                {items.length === 0 ? (
                  <p className="text-sm text-subtle">No streams for the other filter.</p>
                ) : (
                  <BarList
                    label={title}
                    format={metric === 'hours' ? hours : compact}
                    highlight={highlight}
                    items={items.map((item) => ({
                      key: item.key,
                      label: item.key,
                      value: metric === 'hours' ? item.viewing_hours : item.streams,
                      detail: percent(item.share_of_streams),
                    }))}
                  />
                )}
              </Panel>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
