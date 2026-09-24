import { Link, useParams } from 'react-router'
import { ApiError } from '@/api/client'
import { useCollection, useCollections } from '@/api/queries'
import { Poster } from '@/components/common/Poster'
import { ErrorState } from '@/components/common/States'
import { CollectionCover } from '@/components/discover/CollectionCover'
import { assignCovers } from '@/components/discover/covers'
import { Skeleton } from '@/components/ui/skeleton'
import { compact, percent, rating } from '@/lib/format'
import { NotFoundPage } from './NotFoundPage'

function formatMetric(label: string, value: number | null): string {
  if (label === 'Growth') return value === null ? '—' : `+${percent(value)}`
  if (label === 'Rating') return rating(value)
  if (label === 'Engagement' || label === 'Share of months streamed') return percent(value)
  return compact(value)
}

export function CollectionPage() {
  const { collectionId = '' } = useParams()
  const collection = useCollection(collectionId)
  const collections = useCollections()

  if (collection.error instanceof ApiError && collection.error.status === 404) {
    return <NotFoundPage message="This collection does not exist." />
  }
  if (collection.isError)
    return <ErrorState error={collection.error} onRetry={() => collection.refetch()} />
  if (!collection.data) {
    return (
      <div className="flex items-end gap-6 pt-6">
        <Skeleton className="size-48 max-sm:size-32" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    )
  }

  const data = collection.data
  return (
    <div>
      <header className="-mx-6 flex items-end gap-6 bg-gradient-to-b from-pill to-surface px-6 pb-6 pt-8 max-sm:-mx-4 max-sm:flex-col max-sm:items-start max-sm:px-4">
        <CollectionCover
          collection={data}
          cover={
            assignCovers(collections.data?.collections ?? []).get(data.collection_id) ??
            data.items[0]?.movie
          }
          className="w-52 shrink-0 max-sm:w-40"
        />
        <div className="min-w-0">
          <p className="text-sm font-bold">Collection</p>
          <h1 className="mt-2 text-5xl font-black tracking-tight max-sm:text-3xl">{data.title}</h1>
          <p className="mt-4 text-subtle">{data.description}</p>
          <p className="mt-1 text-sm font-bold">{data.items.length} movies</p>
        </div>
      </header>

      <table className="mt-4 w-full text-sm">
        <thead className="border-b text-left text-subtle">
          <tr>
            <th scope="col" className="w-10 py-2 pl-3 font-normal">
              #
            </th>
            <th scope="col" className="py-2 font-normal">
              Title
            </th>
            <th scope="col" className="py-2 font-normal max-md:hidden">
              Genres
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-normal">
              {data.metric_label}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item) => (
            <tr key={item.movie.title_id} className="group hover:bg-hover">
              <td className="rounded-l-md py-2 pl-3 tabular text-subtle">{item.rank}</td>
              <td className="py-2">
                <Link to={`/movies/${item.movie.title_id}`} className="flex items-center gap-3">
                  <Poster
                    src={item.movie.image_url}
                    title={item.movie.title}
                    className="size-10 shrink-0 rounded-sm object-top text-[10px]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium group-hover:underline">
                      {item.movie.title}
                    </span>
                    <span className="text-xs text-subtle">{item.movie.year}</span>
                  </span>
                </Link>
              </td>
              <td className="py-2 text-subtle max-md:hidden">
                {item.movie.genres.slice(0, 3).join(', ')}
              </td>
              <td className="rounded-r-md py-2 pr-3 text-right tabular">
                {formatMetric(data.metric_label, item.metric_value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
