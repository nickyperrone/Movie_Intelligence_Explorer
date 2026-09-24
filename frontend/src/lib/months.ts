// Month keys are "YYYY-MM" strings, as in the API.

export function shiftMonth(month: string, offset: number): string {
  const [year, number] = month.split('-').map(Number)
  const index = year * 12 + (number - 1) + offset
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

export function monthsBetween(start: string, end: string): string[] {
  const months: string[] = []
  for (let month = start; month <= end; month = shiftMonth(month, 1)) months.push(month)
  return months
}
