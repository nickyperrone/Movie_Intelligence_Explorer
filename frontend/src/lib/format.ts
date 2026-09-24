// Display rules from docs/04-metrics.md ("Display").

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const EMPTY = '—'

export function compact(value: number | null | undefined): string {
  if (value === null || value === undefined) return EMPTY
  const abs = Math.abs(value)
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`
  return Math.round(value).toLocaleString('en-US')
}

export function hours(value: number | null | undefined): string {
  return value === null || value === undefined ? EMPTY : `${compact(value)} h`
}

export function percent(ratio: number | null | undefined): string {
  return ratio === null || ratio === undefined ? EMPTY : `${(ratio * 100).toFixed(1)}%`
}

export function signedPercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined) return EMPTY
  const value = ratio * 100
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}%`
}

export function signedPoints(points: number | null | undefined): string {
  if (points === null || points === undefined) return EMPTY
  return `${points >= 0 ? '+' : '−'}${Math.abs(points).toFixed(1)} pp`
}

export function monthLabel(month: string | null | undefined): string {
  if (!month) return EMPTY
  const [year, number] = month.split('-')
  return `${MONTHS[Number(number) - 1]} ${year}`
}

export function monthShort(month: string): string {
  const [year, number] = month.split('-')
  return `${MONTHS[Number(number) - 1]} ’${year.slice(2)}`
}

export function monthRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (!start || !end) return EMPTY
  if (start === end) return monthLabel(start)
  const [startYear] = start.split('-')
  const [endYear] = end.split('-')
  const startText =
    startYear === endYear ? MONTHS[Number(start.split('-')[1]) - 1] : monthLabel(start)
  return `${startText}–${monthLabel(end)}`
}

export function rating(value: number | null | undefined): string {
  return value === null || value === undefined ? EMPTY : value.toFixed(1)
}

export function runtime(minutes: number | null | undefined): string {
  if (!minutes) return EMPTY
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h} h ${m} min` : `${m} min`
}

export function initials(title: string): string {
  return title
    .split(/\s+/)
    .filter((word) => /^[\p{L}\p{N}]/u.test(word))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}
