import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EXAMPLE_QUERIES, useTypedExample } from '@/lib/examples'

function motion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('reduce'),
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

// Each step schedules the next only after React re-renders, so time advances in small acts until
// the expected state appears (or the budget runs out and the assertion after it fails).
function advanceUntil(done: () => boolean, budgetMs = 60_000) {
  for (let elapsed = 0; elapsed < budgetMs && !done(); elapsed += 20)
    act(() => vi.advanceTimersByTime(20))
}

describe('useTypedExample', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    motion(false)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('types an example, holds it, deletes it and types the next one', () => {
    const { result } = renderHook(() => useTypedExample(false))
    expect(result.current).toEqual({ text: '', animating: true })

    advanceUntil(() => result.current.text.length > 0)
    expect(result.current.text).toHaveLength(1)

    advanceUntil(() => EXAMPLE_QUERIES.includes(result.current.text))
    const first = result.current.text
    expect(EXAMPLE_QUERIES).toContain(first)

    advanceUntil(() => result.current.text === '')
    expect(result.current.text).toBe('')

    advanceUntil(() => EXAMPLE_QUERIES.includes(result.current.text))
    expect(EXAMPLE_QUERIES).toContain(result.current.text)
    expect(result.current.text).not.toBe(first)
  })

  it('shows the whole example while paused and moves on when resumed', () => {
    const { result, rerender } = renderHook(({ paused }) => useTypedExample(paused), {
      initialProps: { paused: true },
    })
    const whole = result.current.text
    expect(EXAMPLE_QUERIES).toContain(whole)
    expect(result.current.animating).toBe(false)

    rerender({ paused: false })
    expect(result.current).toEqual({ text: '', animating: true })
    advanceUntil(() => EXAMPLE_QUERIES.includes(result.current.text))
    expect(EXAMPLE_QUERIES).toContain(result.current.text)
    expect(result.current.text).not.toBe(whole)
  })

  it('shows whole examples without typing when motion is reduced', () => {
    motion(true)
    const { result } = renderHook(() => useTypedExample(false))
    expect(EXAMPLE_QUERIES).toContain(result.current.text)
    expect(result.current.animating).toBe(false)
  })
})
