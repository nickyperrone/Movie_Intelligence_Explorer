import { describe, expect, it } from 'vitest'
import { alignSeries, peak, topIndex } from '@/lib/compare'

const point = (month: string, streams: number) => ({ month, streams, viewing_hours: streams / 2 })
const streams = (p: { streams: number }) => p.streams

describe('alignSeries', () => {
  const early = [point('2024-11', 5), point('2024-12', 7), point('2025-01', 9)]
  const late = [point('2025-01', 3), point('2025-02', 4)]

  it('spans every calendar month and leaves months outside a title empty', () => {
    const { keys, values } = alignSeries([early, late], streams, 'calendar')
    expect(keys).toEqual(['2024-11', '2024-12', '2025-01', '2025-02'])
    expect(values).toEqual([
      [5, 7, 9, null],
      [null, null, 3, 4],
    ])
  })

  it('starts every title at month 1 when aligned from launch', () => {
    const { keys, values } = alignSeries([early, late], streams, 'launch')
    expect(keys).toEqual(['1', '2', '3'])
    expect(values).toEqual([
      [5, 7, 9],
      [3, 4, null],
    ])
  })

  it('handles titles without consumption', () => {
    expect(alignSeries([[], []], streams, 'calendar')).toEqual({ keys: [], values: [[], []] })
  })
})

describe('topIndex', () => {
  it('marks the single highest value', () => {
    expect(topIndex([3, 9, 4])).toBe(1)
  })

  it('marks nothing on a tie or with fewer than two values', () => {
    expect(topIndex([7, 7, 2])).toBeNull()
    expect(topIndex([7, null])).toBeNull()
  })
})

describe('peak', () => {
  it('returns the month with the highest value', () => {
    expect(peak([point('2025-01', 3), point('2025-02', 8)], streams)?.month).toBe('2025-02')
  })
})
