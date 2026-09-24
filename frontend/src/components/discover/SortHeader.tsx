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

// A column header that sorts on click; its arrow shows on hover and stays while it is active.
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
          'group inline-flex items-center gap-1 rounded-sm hover:text-white',
          align === 'right' && 'flex-row-reverse',
          active && 'font-bold text-white',
        )}
      >
        {label}
        <Arrow
          aria-hidden
          className={cn(
            'size-3.5 transition-opacity',
            active ? 'opacity-100' : 'opacity-0 group-hover:opacity-60',
          )}
        />
      </button>
    </th>
  )
}
