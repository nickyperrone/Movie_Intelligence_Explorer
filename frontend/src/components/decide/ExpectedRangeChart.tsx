import type { Schemas } from '@/api/client'
import { compact } from '@/lib/format'

type ExpectedRangeChartProps = {
  range: Schemas['ExpectedRange']
  comparables: Schemas['Comparable'][]
  typicalLabel?: string
}

function Legend({ typicalLabel }: { typicalLabel: string }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-subtle">
      <li className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-white/70" /> One comparable title
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-5 rounded-full bg-pink/30" /> Middle half of comparables
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-3 w-0.5 bg-pink" /> Their median
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-3 border-l border-dashed border-white" /> {typicalLabel}
      </li>
    </ul>
  )
}

// One axis of "streams in the first 6 months": the comparables' middle half, their median, the
// median of every title on the target, and one dot per comparable.
export function ExpectedRangeChart({
  range,
  comparables,
  typicalLabel = 'Typical title on this platform and country',
}: ExpectedRangeChartProps) {
  const values = comparables.filter((c) => c.eligible).map((c) => c.first_six_month_streams ?? 0)
  const max = Math.max(...values, range.p75 ?? 0, range.benchmark ?? 0, 1) * 1.08
  const x = (value: number) => `${(value / max) * 100}%`
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((share) => share * max)
  return (
    <figure>
      <p className="text-sm">
        Most comparable titles reached{' '}
        <span className="font-bold">
          {compact(range.p25)} to {compact(range.p75)} streams
        </span>{' '}
        in their first 6 months.
      </p>
      <div
        role="img"
        aria-label={`Comparables' first 6-month streams: median ${compact(range.median)}, middle half ${compact(range.p25)} to ${compact(range.p75)}, typical title ${compact(range.benchmark)}`}
        className="relative mt-10 h-16"
      >
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/15" />
        {range.p25 !== null && range.p75 !== null && (
          <div
            className="absolute top-1/2 h-6 -translate-y-1/2 rounded-full bg-pink/25"
            style={{ left: x(range.p25), width: `calc(${x(range.p75)} - ${x(range.p25)})` }}
          />
        )}
        {values.map((value, index) => (
          <span
            key={index}
            className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70"
            style={{ left: x(value) }}
          />
        ))}
        {range.median !== null && (
          <div className="absolute inset-y-0 w-0.5 bg-pink" style={{ left: x(range.median) }}>
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-bold text-pink">
              Median {compact(range.median)}
            </span>
          </div>
        )}
        {range.benchmark !== null && (
          <div
            className="absolute inset-y-0 border-l border-dashed border-white"
            style={{ left: x(range.benchmark) }}
          >
            <span className="absolute -bottom-6 left-0 -translate-x-1/2 whitespace-nowrap text-xs">
              Typical {compact(range.benchmark)}
            </span>
          </div>
        )}
      </div>
      <div className="relative mt-8 h-4 text-xs text-subtle tabular">
        {ticks.map((tick, index) => (
          <span
            key={index}
            className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
            style={{ left: x(tick) }}
          >
            {compact(tick)}
          </span>
        ))}
      </div>
      <figcaption className="mt-4">
        <Legend typicalLabel={typicalLabel} />
      </figcaption>
    </figure>
  )
}
