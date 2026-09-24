import { useParams } from 'react-router'
import { ApiError } from '@/api/client'
import { useMovie, useSimilar } from '@/api/queries'
import { CardRow } from '@/components/common/CardRow'
import { MovieCard } from '@/components/common/MovieCard'
import { SectionHeader } from '@/components/common/SectionHeader'
import { ErrorState } from '@/components/common/States'
import { AvailabilitySection } from '@/components/movie/AvailabilitySection'
import { InsightPanel } from '@/components/movie/InsightPanel'
import { MovieHeader } from '@/components/movie/MovieHeader'
import { PerformanceSection } from '@/components/movie/PerformanceSection'
import { Skeleton } from '@/components/ui/skeleton'
import { NotFoundPage } from './NotFoundPage'

function SimilarMovies({ titleId }: { titleId: string }) {
  const similar = useSimilar(titleId)
  if (!similar.data?.results.length) return null
  return (
    <section>
      <SectionHeader title="More like this" description="Closest movies by plot and genres." />
      <CardRow label="Similar movies">
        {similar.data.results.map((result) => (
          <MovieCard key={result.movie.title_id} movie={result.movie} className="snap-start" />
        ))}
      </CardRow>
    </section>
  )
}

export function MoviePage() {
  const { titleId = '' } = useParams()
  const movie = useMovie(titleId)

  if (movie.error instanceof ApiError && [404, 422].includes(movie.error.status)) {
    return <NotFoundPage message="This movie is not in the catalog." />
  }
  if (movie.isError)
    return <ErrorState className="mt-6" error={movie.error} onRetry={() => movie.refetch()} />
  if (!movie.data) {
    return (
      <div className="flex gap-8 pt-6">
        <Skeleton className="aspect-[2/3] w-56" />
        <div className="flex-1 space-y-4 pt-24">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-10">
      <MovieHeader movie={movie.data} />
      <PerformanceSection titleId={titleId} />
      <InsightPanel titleId={titleId} />
      <AvailabilitySection titleId={titleId} />
      <SimilarMovies titleId={titleId} />
    </div>
  )
}
