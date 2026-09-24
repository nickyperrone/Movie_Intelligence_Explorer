import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type SectionHeaderProps = {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function SectionHeader({ title, description, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('mb-4 flex items-end justify-between gap-4', className)}>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-sm text-subtle">{description}</p>}
      </div>
      {action && (
        <div className="shrink-0 text-sm font-bold text-subtle hover:text-white">{action}</div>
      )}
    </div>
  )
}
