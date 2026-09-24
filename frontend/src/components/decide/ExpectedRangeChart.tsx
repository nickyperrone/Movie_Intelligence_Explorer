import type { Schemas } from '@/api/client'
import { compact } from '@/lib/format'

type ExpectedRangeChartProps = {
  range: Schemas['ExpectedRange']
  comparables: Schemas['Comparable'][]
}

// One horizontal axis: the p25-p75 band, the comparables' median, the market benchmark and one
// dot per eligible comparable.
export function ExpectedRangeChart({ range, comparables }: ExpectedRangeChartProps) {
  const values = comparables.filter((c) => c.eligible).map((c) => c.first_six_month_streams ?? 0)
  const max = Math.max(...values, range.p75 ?? 0, range.benchmark ?? 0, 1) * 1.08
  const x = (value: number) => `${(value / max) * 100}%`
  return (
    <div
      role="img"
      aria-label={`Comparables' first 6-month streams: median ${compact(range.median)}, middle half ${compact(range.p25)} to ${compact(range.p75)}, benchmark ${compact(range.benchmark)}`}
      className="pt-8"
    >
      <div className="relative h-14">
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
            className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70"
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
            <span className="absolute -bottom-6 left-0 -translate-x-1/2 whitespace-nowrap text-xs text-subtle">
              Market median {compact(range.benchmark)}
            </span>
          </div>
        )}
      </div>
      <div className="mt-8 flex justify-between text-xs text-subtle tabular">
        <span>0</span>
        <span>{compact(max)} streams in first 6 months</span>
      </div>
    </div>
  )
}
