import { Link } from 'react-router'
import type { Schemas } from '@/api/client'
import { cn } from '@/lib/cn'
import { rating } from '@/lib/format'
import { Poster } from './Poster'

type MovieCardProps = {
  movie: Schemas['MovieSummary']
  caption?: string
  className?: string
}

export function MovieCard({ movie, caption, className }: MovieCardProps) {
  return (
    <Link
      to={`/movies/${movie.title_id}`}
      className={cn(
        'group block rounded-lg p-3 transition-colors duration-200 hover:bg-hover',
        className,
      )}
    >
      <Poster
        src={movie.image_url}
        title={movie.title}
        className="aspect-[2/3] w-full rounded-md shadow-lg shadow-black/40"
      />
      <p className="mt-3 truncate font-medium">{movie.title}</p>
      <p className="mt-0.5 line-clamp-2 text-sm text-subtle">
        {caption ??
          [
            movie.year,
            movie.genres.slice(0, 2).join(', '),
            movie.rating !== null && `★ ${rating(movie.rating)}`,
          ]
            .filter(Boolean)
            .join(' · ')}
      </p>
    </Link>
  )
}

export function MovieCardSkeleton() {
  return (
    <div className="p-3">
      <div className="aspect-[2/3] w-full animate-pulse rounded-md bg-pill" />
      <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-pill" />
      <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-pill" />
    </div>
  )
}
