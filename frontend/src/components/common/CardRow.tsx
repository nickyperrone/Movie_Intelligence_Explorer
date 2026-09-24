import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

const EDGE_SPEED_PX_PER_FRAME = 7

// Cards per view from the width of the nearest `@container` (the content area, not the window,
// because the sidebar takes part of it), so a cover stays under about 230 px wide. Shared with
// grids that must match the rows.
export const PER_VIEW =
  '[--per-view:2] @md:[--per-view:3] @2xl:[--per-view:4] @4xl:[--per-view:5] @6xl:[--per-view:6] @7xl:[--per-view:7]'

// A row of same-size cards. A row shorter than the cards per view leaves blank space rather than
// enlarging its cards. Resting the pointer on an edge scrolls the row by itself; clicking an edge
// moves one page; touch screens swipe.
export function CardRow({ children, label }: { children: ReactNode; label: string }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number | null>(null)
  const [canScroll, setCanScroll] = useState({ back: false, forward: false })
  const count = Children.count(children)

  const measure = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    setCanScroll({
      back: track.scrollLeft > 4,
      forward: track.scrollLeft + track.clientWidth < track.scrollWidth - 4,
    })
  }, [])

  const stopGlide = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    trackRef.current?.style.removeProperty('scroll-snap-type')
  }, [])

  useEffect(() => {
    measure()
    const track = trackRef.current
    if (!track) return
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    return () => {
      observer.disconnect()
      stopGlide()
    }
  }, [measure, stopGlide, count])

  function startGlide(direction: 1 | -1) {
    const track = trackRef.current
    if (!track || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    stopGlide()
    // Snapping fights a continuous scroll, so it is paused while gliding.
    track.style.setProperty('scroll-snap-type', 'none')
    const step = () => {
      track.scrollLeft += direction * EDGE_SPEED_PX_PER_FRAME
      frameRef.current = requestAnimationFrame(step)
    }
    frameRef.current = requestAnimationFrame(step)
  }

  function page(direction: 1 | -1) {
    stopGlide()
    const track = trackRef.current
    track?.scrollBy({ left: direction * track.clientWidth, behavior: 'smooth' })
  }

  const edge =
    'absolute inset-y-0 z-10 flex w-16 cursor-pointer items-center text-white/70 transition-opacity duration-200 max-sm:hidden'

  return (
    <div className="group/row relative @container">
      <div
        ref={trackRef}
        onScroll={measure}
        aria-label={label}
        className={cn(
          '-mx-3 grid snap-x snap-mandatory grid-flow-col overflow-x-auto scrollbar-none',
          PER_VIEW,
          '[grid-auto-columns:calc(100%/var(--per-view))]',
        )}
      >
        {children}
      </div>
      {canScroll.back && (
        <button
          type="button"
          aria-label={`Scroll ${label} back`}
          onMouseEnter={() => startGlide(-1)}
          onMouseLeave={stopGlide}
          onClick={() => page(-1)}
          className={cn(
            edge,
            '-left-3 justify-start bg-gradient-to-r from-surface to-transparent pl-1 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100',
          )}
        >
          <ChevronLeft className="size-5" />
        </button>
      )}
      {canScroll.forward && (
        <button
          type="button"
          aria-label={`Scroll ${label} forward`}
          onMouseEnter={() => startGlide(1)}
          onMouseLeave={stopGlide}
          onClick={() => page(1)}
          className={cn(
            edge,
            '-right-3 justify-end bg-gradient-to-l from-surface to-transparent pr-1 opacity-60 group-hover/row:opacity-100 focus-visible:opacity-100',
          )}
        >
          <ChevronRight className="size-5" />
        </button>
      )}
    </div>
  )
}
