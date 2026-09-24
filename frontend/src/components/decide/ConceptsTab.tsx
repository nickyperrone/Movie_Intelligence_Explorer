import { CountryLabel } from '@/components/common/Brand'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useConceptEvaluation, useConceptsMemo } from '@/api/queries'
import { BarList } from '@/components/charts/BarList'
import { ErrorState, Panel } from '@/components/common/States'
import { compact, percent } from '@/lib/format'
import { MemoPanel } from './MemoPanel'

const MIN_LENGTH = 20
const MAX_LENGTH = 600

export function ConceptsTab() {
  const [loglines, setLoglines] = useState(['', ''])
  const evaluation = useConceptEvaluation()
  const memo = useConceptsMemo()
  const valid = loglines.map((text) => text.trim()).filter((text) => text.length >= MIN_LENGTH)

  function evaluate() {
    evaluation.mutate(valid)
    memo.mutate(valid)
  }

  const results = evaluation.data
    ? [...evaluation.data.concepts].sort((a, b) => a.rank - b.rank)
    : []

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-subtle">
        Paste the loglines of shelved or pitched projects. Each one is matched by meaning against
        the catalog; the demand index is the median first-6-month streams of its closest titles.
      </p>
      <div className="grid gap-3 lg:grid-cols-3">
        {loglines.map((text, index) => (
          <div key={index} className="relative rounded-lg bg-raised p-4">
            <label htmlFor={`logline-${index}`} className="text-sm font-bold">
              Concept {index + 1}
            </label>
            {loglines.length > 1 && (
              <button
                type="button"
                aria-label={`Remove concept ${index + 1}`}
                onClick={() => setLoglines(loglines.filter((_, i) => i !== index))}
                className="absolute right-3 top-3 text-subtle hover:text-white"
              >
                <X className="size-4" />
              </button>
            )}
            <textarea
              id={`logline-${index}`}
              value={text}
              maxLength={MAX_LENGTH}
              rows={5}
              onChange={(event) =>
                setLoglines(loglines.map((value, i) => (i === index ? event.target.value : value)))
              }
              placeholder="A retired heist crew in Buenos Aires plans one last job during a city-wide blackout."
              className="mt-2 w-full resize-none rounded-md bg-pill p-3 text-sm outline-none placeholder:text-subtle focus:ring-2 focus:ring-white"
            />
            <p className="text-right text-xs text-subtle tabular">
              {text.length}/{MAX_LENGTH}
              {text.length > 0 &&
                text.trim().length < MIN_LENGTH &&
                ` · at least ${MIN_LENGTH} characters`}
            </p>
          </div>
        ))}
        {loglines.length < 3 && (
          <button
            type="button"
            onClick={() => setLoglines([...loglines, ''])}
            className="grid min-h-40 place-items-center rounded-lg border border-dashed border-white/20 text-sm font-bold text-subtle hover:border-white hover:text-white"
          >
            <span className="flex items-center gap-1.5">
              <Plus className="size-4" /> Add concept
            </span>
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={evaluate}
        disabled={valid.length === 0 || evaluation.isPending}
        className="rounded-full bg-pink px-6 py-3 text-sm font-bold text-black transition-transform hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
      >
        {evaluation.isPending ? 'Evaluating…' : 'Evaluate concepts'}
      </button>

      {evaluation.isError && <ErrorState error={evaluation.error} onRetry={evaluate} />}

      {results.length > 0 && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            {results.map((result) => (
              <Panel key={result.index}>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-5xl font-black text-pink">#{result.rank}</span>
                  <span className="text-right text-xs text-subtle">Concept {result.index + 1}</span>
                </div>
                <p className="mt-2 line-clamp-3 text-sm text-subtle">{result.logline}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs text-subtle">Demand index</dt>
                    <dd className="text-2xl font-bold tabular">{compact(result.demand_index)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-subtle">Released in last 12 months</dt>
                    <dd className="text-2xl font-bold tabular">{result.saturation}</dd>
                  </div>
                </dl>
                {result.comparables.length === 0 ? (
                  <p className="mt-4 text-sm text-subtle">
                    No catalog title is close enough to this concept.
                  </p>
                ) : (
                  <>
                    <h4 className="mt-5 text-xs font-bold uppercase tracking-wider text-subtle">
                      Closest titles
                    </h4>
                    <ul className="mt-2 space-y-1 text-sm">
                      {result.comparables.slice(0, 5).map((comparable) => (
                        <li key={comparable.movie.title_id} className="flex justify-between gap-2">
                          <Link
                            to={`/movies/${comparable.movie.title_id}`}
                            className="truncate hover:underline"
                          >
                            {comparable.movie.title}
                          </Link>
                          <span className="shrink-0 text-subtle tabular">
                            {Math.round(comparable.score * 100)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                    <h4 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-subtle">
                      Where they stream
                    </h4>
                    <BarList
                      label={`Demand by country for concept ${result.index + 1}`}
                      format={percent}
                      items={result.demand_by_country.map((item) => ({
                        key: item.key,
                        label: <CountryLabel country={item.key} />,
                        value: item.share_of_streams,
                      }))}
                    />
                  </>
                )}
              </Panel>
            ))}
          </div>
          <MemoPanel
            title="Project comparison"
            status={memo.data?.status ?? (memo.isError ? 'failed' : undefined)}
            paragraphs={[memo.data?.summary ?? '', ...(memo.data?.per_concept ?? [])].filter(
              Boolean,
            )}
            caveats={memo.data?.caveats ?? []}
          />
        </>
      )}
    </div>
  )
}
