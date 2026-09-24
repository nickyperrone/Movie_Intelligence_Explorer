import type { Schemas } from '@/api/client'
import { Poster } from '@/components/common/Poster'
import { cn } from '@/lib/cn'
import { bandColor, textOn } from './covers'

type CollectionCoverProps = {
  collection: Pick<Schemas['CollectionSummary'], 'collection_id' | 'section' | 'title'>
  cover: Schemas['MovieSummary'] | undefined
  className?: string
}

export function CollectionCover({ collection, cover, className }: CollectionCoverProps) {
  const color = bandColor(collection)
  return (
    <div
      className={cn(
        'relative aspect-square overflow-hidden rounded-lg shadow-xl shadow-black/50',
        className,
      )}
    >
      <Poster
        src={cover?.image_url}
        title={cover?.title ?? collection.title}
        className="size-full object-top"
      />
      <div className="absolute inset-x-0 bottom-[14%] flex items-stretch">
        <span className="w-1.5 shrink-0" style={{ background: color }} />
        <span
          className="ml-1.5 flex-1 truncate px-2 py-1 text-base font-bold"
          style={{ background: color, color: textOn(color) }}
        >
          {collection.title}
        </span>
      </div>
    </div>
  )
}
