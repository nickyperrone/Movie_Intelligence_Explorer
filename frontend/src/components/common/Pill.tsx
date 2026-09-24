import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

type PillProps = ComponentProps<'button'> & { active?: boolean }

export function Pill({ active = false, className, ...props }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'pressable inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors duration-150',
        active ? 'bg-white text-black' : 'bg-pill text-white hover:bg-hover',
        className,
      )}
      {...props}
    />
  )
}
