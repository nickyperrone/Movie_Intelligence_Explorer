import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/cn'

export type SortDirection = 'asc' | 'desc'

type SortHeaderProps = {
  label: string
  active: boolean
  direction: SortDirection
  onSort: () => void
  align?: 'left' | 'right'
  className?: string
}

// A column header that sorts on click. Only the active column shows its arrow, to the right of
// the label; clicking the active column reverses the direction.
export function SortHeader({
  label,
  active,
  direction,
  onSort,
  align = 'left',
  className,
}: SortHeaderProps) {
  const Arrow = direction === 'asc' ? ArrowUp : ArrowDown
  return (
    <th
      scope="col"
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('py-2 font-normal', align === 'right' && 'text-right', className)}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          'pressable inline-flex items-center gap-1 rounded-sm hover:text-white',
          active && 'font-bold text-white',
        )}
      >
        {label}
        {active && <Arrow aria-hidden className="size-3.5" />}
      </button>
    </th>
  )
}
