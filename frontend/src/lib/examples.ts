import { useEffect, useState, useSyncExternalStore } from 'react'

export const EXAMPLE_QUERIES = [
  'dark psychological thrillers about obsession',
  'family movies about overcoming loss',
  'animated adventures',
  'movies about artificial intelligence',
  'heist movies with a crew of thieves',
  'horror movies about haunted houses',
  'true crime documentaries',
  'space exploration and astronauts',
  'music documentaries',
  'romantic comedies at Christmas',
  'sports underdog stories',
  'Ryan Gosling',
  'Florence Pugh',
  'Guillermo del Toro',
  // Not "directed by women": the data has no director gender, so that query cannot be answered.
  'stories led by women',
]

const ROTATION_MS = 4000

// Keyed by how many examples a caller shows, so the Search page and the search box do not reset
// each other's memory.
const lastFirst = new Map<number, string>()

// A new order on every mount, so opening Search again shows different examples.
function shuffledExamples(count: number): string[] {
  const order = [...EXAMPLE_QUERIES]
  do {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
  } while (order[0] === lastFirst.get(count))
  return order
}

// Returns `count` examples that advance every few seconds; they stay still while paused or with
// reduced motion. `tick` changes with each step, for keying a fade.
export function useExamples(count: number, paused: boolean): { examples: string[]; tick: number } {
  const [order] = useState(() => shuffledExamples(count))
  // Remembered once shown: in development React builds the initial state twice and keeps one.
  useEffect(() => {
    lastFirst.set(count, order[0])
  }, [count, order])
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => setTick((current) => current + 1), ROTATION_MS)
    return () => clearInterval(timer)
  }, [paused])
  const examples = Array.from({ length: count }, (_, i) => order[(tick * count + i) % order.length])
  return { examples, tick }
}

const TYPE_MIN_MS = 45
const TYPE_MAX_MS = 95
const DELETE_MS = 30
const HOLD_MS = 2200
const GAP_MS = 400

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function subscribeToVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

type Typing = { index: number; letters: number; deleting: boolean }

// The search box example, typed and deleted letter by letter (docs/07-frontend.md, "Search
// examples"). While paused it shows the whole example; on resume it moves on to the next one.
export function useTypedExample(paused: boolean): { text: string; animating: boolean } {
  const [order] = useState(() => shuffledExamples(1))
  useEffect(() => {
    lastFirst.set(1, order[0])
  }, [order])
  const [reduced] = useState(reducedMotion)
  const hidden = useSyncExternalStore(subscribeToVisibility, () => document.hidden)
  const [typing, setTyping] = useState<Typing>({ index: 0, letters: 0, deleting: false })
  const example = order[typing.index % order.length]
  const running = !paused && !hidden

  useEffect(() => {
    if (!paused) return
    return () => setTyping((current) => ({ index: current.index + 1, letters: 0, deleting: false }))
  }, [paused])

  useEffect(() => {
    if (!running) return
    let delay: number
    let next: Typing
    if (reduced) {
      delay = ROTATION_MS
      next = { index: typing.index + 1, letters: 0, deleting: false }
    } else if (!typing.deleting && typing.letters < example.length) {
      // Irregular gaps read as a person typing rather than a machine.
      delay = TYPE_MIN_MS + Math.random() * (TYPE_MAX_MS - TYPE_MIN_MS)
      next = { ...typing, letters: typing.letters + 1 }
    } else if (!typing.deleting) {
      delay = HOLD_MS
      next = { ...typing, deleting: true }
    } else if (typing.letters > 0) {
      delay = DELETE_MS
      next = { ...typing, letters: typing.letters - 1 }
    } else {
      delay = GAP_MS
      next = { index: typing.index + 1, letters: 0, deleting: false }
    }
    const timer = setTimeout(() => setTyping(next), delay)
    return () => clearTimeout(timer)
  }, [running, reduced, typing, example.length])

  if (paused || reduced) return { text: example, animating: false }
  return { text: example.slice(0, typing.letters), animating: true }
}
