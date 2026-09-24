import { Link } from 'react-router'
import type { Schemas } from '@/api/client'
import { cn } from '@/lib/cn'
import { CollectionCover } from './CollectionCover'

function subtitle(collection: Schemas['CollectionSummary']): string {
  const next = collection.preview.slice(0, 2).map((movie) => movie.title)
  if (next.length === 0) return collection.description
  return `${next.join(', ')} and more`
}

export function CollectionCard({
  collection,
  cover,
  className,
}: {
  collection: Schemas['CollectionSummary']
  cover: Schemas['MovieSummary'] | undefined
  className?: string
}) {
  return (
    <Link
      to={`/discover/${collection.collection_id}`}
      className={cn(
        'group block snap-start rounded-lg p-3 transition-colors duration-200 hover:bg-hover',
        className,
      )}
    >
      <CollectionCover collection={collection} cover={cover} />
      <p className="mt-3 truncate font-medium">{collection.title}</p>
      <p className="mt-0.5 line-clamp-2 text-sm text-subtle">{subtitle(collection)}</p>
    </Link>
  )
}
