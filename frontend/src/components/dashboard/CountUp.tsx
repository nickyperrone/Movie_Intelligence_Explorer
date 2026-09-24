import { useEffect, useRef, useState } from 'react'

const DURATION_MS = 600

// No count-up with reduced motion, or in a hidden tab (where animation frames do not run).
function skipAnimation(): boolean {
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.visibilityState !== 'visible'
  )
}

// Counts from zero to the value the first time it appears; later values show immediately.
export function CountUp({
  value,
  format,
}: {
  value: number | null
  format: (value: number | null) => string
}) {
  // Holds the in-between number only while counting; otherwise the real value is shown.
  const [tween, setTween] = useState<number | null>(() =>
    value !== null && !skipAnimation() ? 0 : null,
  )
  const animated = useRef(false)

  useEffect(() => {
    if (value === null || animated.current || skipAnimation()) return
    const started = performance.now()
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min((now - started) / DURATION_MS, 1)
      setTween(progress < 1 ? value * (1 - (1 - progress) ** 3) : null)
      // Marked done only at the end: in development React runs effects twice and the first run is
      // cancelled before it finishes.
      if (progress < 1) frame = requestAnimationFrame(step)
      else animated.current = true
    })
    return () => cancelAnimationFrame(frame)
  }, [value])

  return <>{format(tween ?? value)}</>
}
