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
        'relative aspect-[2/3] overflow-hidden rounded-lg shadow-xl shadow-black/50',
        className,
      )}
    >
      <Poster
        src={cover?.image_url}
        title={cover?.title ?? collection.title}
        className="size-full object-top"
      />
      {/* Every band has the same height and one line. The text keeps the standard size unless the
          name would not fit, then it shrinks just enough (cqi = 1% of the band's width). */}
      <div className="absolute inset-x-0 bottom-[10%] flex h-8 items-stretch [container-type:inline-size]">
        <span className="w-1.5 shrink-0" style={{ background: color }} />
        <span
          className="ml-1.5 flex flex-1 items-center overflow-hidden whitespace-nowrap px-2 font-bold"
          style={{
            background: color,
            color: textOn(color),
            fontSize: `min(15px, calc((100cqi - 32px) / ${Math.max(collection.title.length, 1) * 0.6}))`,
          }}
        >
          {collection.title}
        </span>
      </div>
    </div>
  )
}
