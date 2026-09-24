import {
  compact,
  hours,
  monthLabel,
  monthRange,
  percent,
  signedPercent,
  signedPoints,
} from '@/lib/format'
import { monthsBetween, shiftMonth } from '@/lib/months'

describe('format', () => {
  it('compacts counts', () => {
    expect(compact(950)).toBe('950')
    expect(compact(1234)).toBe('1.2K')
    expect(compact(3_450_000)).toBe('3.5M')
    expect(compact(null)).toBe('—')
  })

  it('formats hours, percents and signed changes', () => {
    expect(hours(12_300)).toBe('12.3K h')
    expect(percent(0.724)).toBe('72.4%')
    expect(signedPercent(0.123)).toBe('+12.3%')
    expect(signedPercent(-0.041)).toBe('−4.1%')
    expect(signedPoints(-4.1)).toBe('−4.1 pp')
  })

  it('formats months and ranges', () => {
    expect(monthLabel('2025-03')).toBe('Mar 2025')
    expect(monthRange('2026-04', '2026-06')).toBe('Apr–Jun 2026')
    expect(monthRange('2025-07', '2026-06')).toBe('Jul 2025–Jun 2026')
    expect(monthRange('2025-03', '2025-03')).toBe('Mar 2025')
  })
})

describe('months', () => {
  it('shifts across years', () => {
    expect(shiftMonth('2026-06', -11)).toBe('2025-07')
    expect(shiftMonth('2025-12', 1)).toBe('2026-01')
  })

  it('lists every month in a range', () => {
    expect(monthsBetween('2025-11', '2026-02')).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ])
  })
})
