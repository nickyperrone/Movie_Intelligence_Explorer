import { useState } from 'react'
import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'

type PosterProps = {
  src: string | null | undefined
  title: string
  className?: string
}

// Posters come from external URLs that can be missing or broken; both cases show initials.
export function Poster({ src, title, className }: PosterProps) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={title}
        className={cn(
          'flex items-center justify-center bg-gradient-to-br from-pill to-hover text-subtle font-bold',
          className,
        )}
      >
        <span className="text-2xl tracking-tight">{initials(title)}</span>
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={title}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('object-cover', className)}
    />
  )
}
