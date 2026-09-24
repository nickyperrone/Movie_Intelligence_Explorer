import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BarItem = { key: string; label: ReactNode; value: number; detail?: string }

type BarListProps = {
  items: BarItem[]
  format: (value: number) => string
  label: string
  highlight?: string[]
  // When set, each row is a button that applies the row's key as a filter.
  onSelect?: (key: string) => void
}

// Horizontal bars sorted by value; plain elements keep labels readable and accessible.
export function BarList({ items, format, label, highlight = [], onSelect }: BarListProps) {
  const max = Math.max(...items.map((item) => item.value), 0)
  return (
    <ul aria-label={label} className="space-y-3">
      {items.map((item) => (
        <li key={item.key}>
          {onSelect ? (
            <button
              type="button"
              onClick={() => onSelect(item.key)}
              className="pressable -mx-2 block w-[calc(100%+1rem)] rounded-md px-2 py-1 text-left hover:bg-white/5"
            >
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{item.label}</span>
                <span className="shrink-0 tabular text-subtle">
                  {format(item.value)}
                  {item.detail && <span className="ml-2 text-xs">{item.detail}</span>}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-pill">
                <div
                  className={cn(
                    'h-full rounded-full',
                    highlight.length === 0 || highlight.includes(item.key)
                      ? 'bg-pink'
                      : 'bg-subtle/50',
                  )}
                  style={{ width: max ? `${(item.value / max) * 100}%` : '0%' }}
                />
              </div>
            </button>
          ) : (
            <div>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{item.label}</span>
                <span className="shrink-0 tabular text-subtle">
                  {format(item.value)}
                  {item.detail && <span className="ml-2 text-xs">{item.detail}</span>}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-pill">
                <div
                  className={cn(
                    'h-full rounded-full',
                    highlight.length === 0 || highlight.includes(item.key)
                      ? 'bg-pink'
                      : 'bg-subtle/50',
                  )}
                  style={{ width: max ? `${(item.value / max) * 100}%` : '0%' }}
                />
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
