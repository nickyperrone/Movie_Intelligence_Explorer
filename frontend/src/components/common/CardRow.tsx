import type { ReactNode } from 'react'

// A horizontal row of cards with scroll snap, as in a streaming home screen.
export function CardRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      aria-label={label}
      className="-mx-3 flex snap-x snap-mandatory gap-1 overflow-x-auto scrollbar-none"
    >
      {children}
    </div>
  )
}
