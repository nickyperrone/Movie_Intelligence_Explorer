import { ExternalLink, Star } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import type { Schemas } from '@/api/client'
import { Poster } from '@/components/common/Poster'
import { compact, rating, runtime } from '@/lib/format'

export function MovieHeader({ movie }: { movie: Schemas['MovieDetail'] }) {
  const [showCast, setShowCast] = useState(false)
  return (
    <header className="-mx-6 bg-gradient-to-b from-pill/80 to-surface px-6 pb-8 pt-6 max-sm:-mx-4 max-sm:px-4">
      <div className="flex gap-8 max-md:flex-col">
        <Poster
          src={movie.image_url}
          title={movie.title}
          className="aspect-[2/3] w-56 shrink-0 rounded-lg shadow-2xl shadow-black/60 max-md:w-40"
        />
        <div className="flex min-w-0 flex-col justify-end">
          <p className="text-sm font-bold">Movie</p>
          <h1 className="mt-2 text-5xl font-black leading-tight tracking-tight max-sm:text-3xl">
            {movie.title}
          </h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-bold">{movie.year}</span>
            <span className="text-subtle">·</span>
            <span>{runtime(movie.runtime_minutes)}</span>
            <span className="text-subtle">·</span>
            <span>{movie.genres.join(', ') || '—'}</span>
            <span className="text-subtle">·</span>
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5 fill-pink text-pink" />
              {rating(movie.rating)}
              <span className="text-subtle">({compact(movie.vote_count)} votes)</span>
            </span>
            {movie.theme && (
              <>
                <span className="text-subtle">·</span>
                <Link
                  to={`/discover/theme-${movie.theme.theme_id}`}
                  className="underline-offset-2 hover:underline"
                >
                  {movie.theme.name}
                </Link>
              </>
            )}
          </p>
          {movie.plot_summary && (
            <p className="mt-4 max-w-3xl leading-relaxed text-subtle">{movie.plot_summary}</p>
          )}
          <dl className="mt-4 grid max-w-3xl grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-subtle">Directed by</dt>
            <dd>{movie.directors.join(', ') || '—'}</dd>
            <dt className="text-subtle">Starring</dt>
            <dd>
              {(showCast ? movie.cast : movie.principal_cast).join(', ') || '—'}
              {movie.cast.length > movie.principal_cast.length && (
                <button
                  type="button"
                  onClick={() => setShowCast((value) => !value)}
                  className="ml-2 font-bold text-subtle hover:text-white"
                >
                  {showCast ? 'Show less' : 'Show full cast'}
                </button>
              )}
            </dd>
          </dl>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to={`/decide?tab=licensing&title=${movie.title_id}`}
              className="rounded-full bg-brand px-6 py-3 text-sm font-bold text-black transition-transform hover:scale-105"
            >
              Assess a deal
            </Link>
            {movie.title_url && (
              <a
                href={movie.title_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/30 px-4 py-2.5 text-sm font-bold hover:border-white"
              >
                IMDb <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
