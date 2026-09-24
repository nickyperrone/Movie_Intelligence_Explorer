import type { Schemas } from '@/api/client'

export type Align = 'calendar' | 'launch'

type Series = Schemas['MonthlyPoint'][]

function monthIndex(month: string): number {
  const [year, number] = month.split('-').map(Number)
  return year * 12 + number - 1
}

function monthKey(index: number): string {
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

// Lines up several monthly series on one x axis. "calendar" uses real months from the earliest to
// the latest; "launch" counts months from each title's first month with data (keys "1", "2"...).
// Months outside a title's own range are null, so its line starts and ends where its data does.
export function alignSeries(
  series: Series[],
  value: (point: Schemas['MonthlyPoint']) => number,
  align: Align,
): { keys: string[]; values: (number | null)[][] } {
  const present = series.filter((points) => points.length > 0)
  if (present.length === 0) return { keys: [], values: series.map(() => []) }

  if (align === 'launch') {
    const length = Math.max(...present.map((points) => points.length))
    return {
      keys: Array.from({ length }, (_, index) => String(index + 1)),
      values: series.map((points) =>
        Array.from({ length }, (_, index) => (points[index] ? value(points[index]) : null)),
      ),
    }
  }

  const first = Math.min(...present.map((points) => monthIndex(points[0].month)))
  const last = Math.max(...present.map((points) => monthIndex(points.at(-1)!.month)))
  const keys = Array.from({ length: last - first + 1 }, (_, index) => monthKey(first + index))
  return {
    keys,
    values: series.map((points) => {
      const byMonth = new Map(points.map((point) => [point.month, value(point)]))
      return keys.map((key) => byMonth.get(key) ?? null)
    }),
  }
}

// Index of the single highest value, or null when fewer than 2 values exist or the top is tied.
export function topIndex(values: (number | null | undefined)[]): number | null {
  const known = values.filter((value): value is number => value !== null && value !== undefined)
  if (known.length < 2) return null
  const best = Math.max(...known)
  if (values.filter((value) => value === best).length > 1) return null
  return values.indexOf(best)
}

export function peak(series: Series, value: (point: Schemas['MonthlyPoint']) => number) {
  return series.reduce<Schemas['MonthlyPoint'] | null>(
    (best, point) => (best === null || value(point) > value(best) ? point : best),
    null,
  )
}
