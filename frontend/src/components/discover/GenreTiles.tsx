import { createElement } from 'react'
import { Link } from 'react-router'
import { useFilterOptions } from '@/api/queries'
import { genreIcon } from '@/lib/genres'
import { SectionHeader } from '@/components/common/SectionHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { bandColor, textOn } from './covers'

// "Browse by genre": one tile per primary genre; each opens the dashboard filtered by it.
export function GenreTiles() {
  const options = useFilterOptions()
  return (
    <section className="mt-10">
      <SectionHeader title="Browse by genre" description="Open the charts for one genre." />
      <div className="grid grid-cols-6 gap-3 max-xl:grid-cols-4 max-md:grid-cols-3 max-sm:grid-cols-2">
        {!options.data
          ? Array.from({ length: 12 }, (_, index) => (
              <Skeleton key={index} className="aspect-[16/9]" />
            ))
          : options.data.primary_genres.map((genre) => {
              const color = bandColor({
                collection_id: `genre-${genre}`,
                section: 'now',
                title: genre,
              })
              return (
                <Link
                  key={genre}
                  to={`/?genres=${encodeURIComponent(genre)}`}
                  className="pressable appear group relative aspect-[16/9] overflow-hidden rounded-lg p-3"
                  style={{ background: color, color: textOn(color) }}
                >
                  <span className="text-lg font-bold leading-tight">{genre}</span>
                  {createElement(genreIcon(genre), {
                    'aria-hidden': true,
                    className:
                      'absolute -bottom-2 -right-2 size-16 rotate-[20deg] opacity-40 transition-transform duration-300 group-hover:scale-110',
                  })}
                </Link>
              )
            })}
      </div>
    </section>
  )
}
