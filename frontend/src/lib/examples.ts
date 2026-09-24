import { useEffect, useState } from 'react'

export const EXAMPLE_QUERIES = [
  'dark psychological thrillers about obsession',
  'family movies about overcoming loss',
  'animated adventures',
  'movies about artificial intelligence',
  'heist movies with a crew of thieves',
  'películas de terror sobre casas embrujadas',
  'true crime documentaries',
  'space exploration and astronauts',
  'documentales sobre música',
  'romantic comedies at Christmas',
  'sports underdog stories',
  'Ryan Gosling',
]

const ROTATION_MS = 4000

// Advances an index every few seconds; stays still while paused or with reduced motion.
export function useRotation(paused: boolean): number {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => setIndex((current) => current + 1), ROTATION_MS)
    return () => clearInterval(timer)
  }, [paused])
  return index
}

export function examplesAt(index: number, count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) => EXAMPLE_QUERIES[(index * count + i) % EXAMPLE_QUERIES.length],
  )
}
