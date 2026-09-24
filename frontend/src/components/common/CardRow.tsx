import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/cn'

// A row of cards that always fills the width: 2, 3 or 5 cards per view by screen size, capped by
// `maxPerView` (a page passes its shortest row's length so every card has the same size) or by
// the row's own length. Small arrows scroll one view at a time.
export function CardRow({
  children,
  label,
  maxPerView,
}: {
  children: ReactNode
  label: string
  maxPerView?: number
}) {
  const trackRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    measure()
    const track = trackRef.current
    if (!track) return
    const observer = new ResizeObserver(measure)
    observer.observe(track)
    return () => observer.disconnect()
  }, [measure, count])

  function scroll(direction: 1 | -1) {
    const track = trackRef.current
    track?.scrollBy({ left: direction * track.clientWidth, behavior: 'smooth' })
  }

  const arrow =
    'absolute top-[38%] z-10 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/80 text-white shadow-lg transition-opacity hover:bg-black focus-visible:opacity-100'

  return (
    <div className="group/row relative">
      <div
        ref={trackRef}
        onScroll={measure}
        aria-label={label}
        style={{ '--max': maxPerView ?? count } as CSSProperties}
        className={cn(
          '-mx-3 grid snap-x snap-mandatory grid-flow-col overflow-x-auto scrollbar-none',
          '[--per-view:2] sm:[--per-view:3] lg:[--per-view:5]',
          '[grid-auto-columns:calc(100%/min(var(--per-view),var(--max)))]',
        )}
      >
        {children}
      </div>
      {canScroll.back && (
        <button
          type="button"
          aria-label={`Scroll ${label} back`}
          onClick={() => scroll(-1)}
          className={cn(arrow, '-left-3 opacity-0 group-hover/row:opacity-100')}
        >
          <ChevronLeft className="size-5" />
        </button>
      )}
      {canScroll.forward && (
        <button
          type="button"
          aria-label={`Scroll ${label} forward`}
          onClick={() => scroll(1)}
          className={cn(arrow, '-right-3 opacity-80 group-hover/row:opacity-100')}
        >
          <ChevronRight className="size-5" />
        </button>
      )}
    </div>
  )
}
