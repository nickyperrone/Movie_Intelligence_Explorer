import { Link } from 'react-router'
import type { Schemas } from '@/api/client'
import { Poster } from '@/components/common/Poster'
import { cn } from '@/lib/cn'
import { compact, hours, percent, signedPercent } from '@/lib/format'

type Sort = Schemas['TitleSort']

const COLUMNS: { sort: Sort; label: string }[] = [
  { sort: 'streams', label: 'Streams' },
  { sort: 'viewing_hours', label: 'Hours' },
  { sort: 'engagement', label: 'Engagement' },
  { sort: 'growth', label: 'Growth' },
]

type TopTitlesTableProps = {
  items: Schemas['RankedTitle'][]
  sort: Sort
  onSort: (sort: Sort) => void
}

export function TopTitlesTable({ items, sort, onSort }: TopTitlesTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b text-left text-subtle">
          <tr>
            <th scope="col" className="w-10 py-2 pl-2 font-normal">
              #
            </th>
            <th scope="col" className="py-2 font-normal">
              Title
            </th>
            {COLUMNS.map((column) => (
              <th
                key={column.sort}
                scope="col"
                aria-sort={sort === column.sort ? 'descending' : 'none'}
                className="py-2 pr-2 text-right font-normal"
              >
                <button
                  type="button"
                  onClick={() => onSort(column.sort)}
                  className={cn('hover:text-white', sort === column.sort && 'font-bold text-white')}
                >
                  {column.label}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.movie.title_id} className="group hover:bg-hover">
              <td className="rounded-l-md py-2 pl-2 tabular text-subtle">{item.rank}</td>
              <td className="py-2">
                <Link to={`/movies/${item.movie.title_id}`} className="flex items-center gap-3">
                  <Poster
                    src={item.movie.image_url}
                    title={item.movie.title}
                    className="h-12 w-8 shrink-0 rounded-sm text-[10px]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium group-hover:underline">
                      {item.movie.title}
                    </span>
                    <span className="text-xs text-subtle">
                      {item.movie.year} · {item.movie.primary_genre ?? '—'}
                    </span>
                  </span>
                </Link>
              </td>
              <td className="py-2 pr-2 text-right tabular">{compact(item.streams)}</td>
              <td className="py-2 pr-2 text-right tabular">{hours(item.viewing_hours)}</td>
              <td className="py-2 pr-2 text-right tabular">
                <span
                  className={cn(item.engagement !== null && item.engagement > 1 && 'text-warning')}
                >
                  {percent(item.engagement)}
                </span>
              </td>
              <td
                className={cn(
                  'rounded-r-md py-2 pr-2 text-right tabular',
                  item.growth_pct !== null &&
                    (item.growth_pct >= 0 ? 'text-green' : 'text-negative'),
                )}
              >
                {signedPercent(item.growth_pct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
