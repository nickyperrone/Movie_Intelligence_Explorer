import type { ReactNode } from 'react'
import { ApiError } from '@/api/client'
import { cn } from '@/lib/cn'

export function EmptyState({
  message,
  children,
  className,
}: {
  message: string
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-lg bg-raised px-6 py-10 text-center', className)}>
      <p className="text-subtle">{message}</p>
      {children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  )
}

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown
  onRetry?: () => void
  className?: string
}) {
  const message =
    error instanceof ApiError ? error.message : 'Something went wrong while loading this section.'
  return (
    <div role="alert" className={cn('rounded-lg bg-raised px-6 py-8 text-center', className)}>
      <p className="text-negative">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-full bg-white px-4 py-1.5 text-sm font-bold text-black hover:scale-105"
        >
          Retry
        </button>
      )}
    </div>
  )
}

export function Panel({
  title,
  children,
  className,
  aside,
}: {
  title?: string
  children: ReactNode
  className?: string
  aside?: ReactNode
}) {
  return (
    <section className={cn('rounded-lg bg-raised p-5', className)}>
      {title && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-bold">{title}</h3>
          {aside}
        </div>
      )}
      {children}
    </section>
  )
}
