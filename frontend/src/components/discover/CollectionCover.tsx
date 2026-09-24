import type { Schemas } from '@/api/client'
import { Poster } from '@/components/common/Poster'
import { cn } from '@/lib/cn'

// Light band colors with dark text, picked by a hash of the collection id so each cover keeps
// its color across reloads.
const BAND_COLORS = [
  '#ff8a7a',
  '#f573c7',
  '#4f9cf9',
  '#c7c9f9',
  '#f7d154',
  '#7ee2b8',
  '#ffa05c',
  '#b490f5',
]

function bandColor(collectionId: string): string {
  let hash = 0
  for (const char of collectionId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return BAND_COLORS[hash % BAND_COLORS.length]
}

type CollectionCoverProps = {
  collectionId: string
  title: string
  cover: Schemas['MovieSummary'] | undefined
  className?: string
  large?: boolean
}

export function CollectionCover({
  collectionId,
  title,
  cover,
  className,
  large = false,
}: CollectionCoverProps) {
  const color = bandColor(collectionId)
  return (
    <div
      className={cn(
        'relative aspect-square overflow-hidden rounded-lg shadow-xl shadow-black/50',
        className,
      )}
    >
      <Poster
        src={cover?.image_url}
        title={cover?.title ?? title}
        className="size-full object-top"
      />
      <div className="absolute inset-x-0 bottom-[14%] flex items-stretch">
        <span className="w-1.5 shrink-0" style={{ background: color }} />
        <span
          className={cn(
            'ml-1.5 flex-1 truncate px-2 py-1 font-bold text-black',
            large ? 'text-2xl' : 'text-base',
          )}
          style={{ background: color }}
        >
          {title}
        </span>
      </div>
    </div>
  )
}
