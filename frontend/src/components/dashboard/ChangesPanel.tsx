import { Link } from 'react-router'
import type { Schemas } from '@/api/client'
import { Narrative } from '@/components/common/Narrative'
import { Panel } from '@/components/common/States'
import { cn } from '@/lib/cn'
import { compact, monthRange, signedPoints } from '@/lib/format'

function MoverList({
  title,
  movers,
  positive,
}: {
  title: string
  movers: Schemas['Mover'][]
  positive: boolean
}) {
  return (
    <div>
      <h4 className="mb-2 text-sm text-subtle">{title}</h4>
      {movers.length === 0 ? (
        <p className="text-sm text-subtle">None</p>
      ) : (
        <ol className="space-y-2">
          {movers.map((mover) => (
            <li
              key={mover.movie.title_id}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <Link to={`/movies/${mover.movie.title_id}`} className="truncate hover:underline">
                {mover.movie.title}
              </Link>
              <span
                className={cn(
                  'shrink-0 font-bold tabular',
                  positive ? 'text-positive' : 'text-negative',
                )}
              >
                {mover.change > 0 ? '+' : '−'}
                {compact(Math.abs(mover.change))}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export function ChangesPanel({ changes }: { changes: Schemas['DashboardChanges'] }) {
  if (!changes.previous_period) {
    return (
      <Panel title="What changed">
        <p className="text-sm text-subtle">
          The previous period starts before the data (Jan 2023), so there is nothing to compare.
        </p>
      </Panel>
    )
  }
  const shifts = changes.share_shifts.slice(0, 4)
  return (
    <Panel
      title="What changed"
      aside={
        <span className="text-xs text-subtle">
          vs {monthRange(changes.previous_period.start, changes.previous_period.end)}
        </span>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <MoverList title="Biggest gains in streams" movers={changes.gainers} positive />
        <MoverList title="Biggest drops in streams" movers={changes.decliners} positive={false} />
        <div>
          <h4 className="mb-2 text-sm text-subtle">Share of streams</h4>
          <ul className="space-y-2">
            {shifts.map((shift) => (
              <li
                key={`${shift.dimension}-${shift.key}`}
                className="flex justify-between gap-3 text-sm"
              >
                <span>{shift.key}</span>
                <span
                  className={cn(
                    'font-bold tabular',
                    shift.change_pp >= 0 ? 'text-positive' : 'text-negative',
                  )}
                >
                  {signedPoints(shift.change_pp)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-6 border-t pt-4">
        <Narrative status={changes.narrative.status} text={changes.narrative.text} />
      </div>
    </Panel>
  )
}
