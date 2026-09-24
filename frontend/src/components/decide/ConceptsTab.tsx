import { ChevronDown, Film, Plus, Scale, Search, Sparkles, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { Schemas } from '@/api/client'
import { useConceptEvaluation, useConceptsMemo } from '@/api/queries'
import { BarList } from '@/components/charts/BarList'
import { CountryLabel } from '@/components/common/Brand'
import { Poster } from '@/components/common/Poster'
import { ErrorState, Panel } from '@/components/common/States'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'
import { compact, monthLabel, percent } from '@/lib/format'
import { ExpectedRangeChart } from './ExpectedRangeChart'
import { MemoPanel } from './MemoPanel'

const MIN_LENGTH = 20
const MAX_LENGTH = 600
const MAX_CONCEPTS = 3

const EXAMPLES = [
  'A teenage girl group of pop stars secretly hunts demons with the power of their songs.',
  'A retired detective in a small coastal town investigates disappearances tied to his past.',
  'An astronaut stranded on Mars must survive alone until a rescue mission arrives.',
]

const STEPS = [
  { icon: Film, text: 'Describe up to 3 projects in a sentence or two.' },
  { icon: Search, text: 'We find the most similar movies in the catalog, by meaning.' },
  { icon: Scale, text: 'We compare how those movies did in their first 6 months.' },
]

const DECISION: Record<Schemas['ConceptDecision']['status'], { label: string; tone: string }> = {
  clear_lead: { label: 'Clear lead', tone: 'bg-pink text-black' },
  narrow_lead: { label: 'Narrow lead', tone: 'bg-white text-black' },
  too_close: { label: 'Too close to call', tone: 'bg-pill text-white' },
  single: { label: 'One concept', tone: 'bg-pill text-white' },
  insufficient_evidence: { label: 'Not enough evidence', tone: 'bg-pill text-white' },
}

const EVIDENCE: Record<Schemas['EvidenceLevel'], string> = {
  high: 'High evidence',
  medium: 'Medium evidence',
  low: 'Low evidence',
  insufficient_evidence: 'Not enough evidence',
}

function Reasons({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm leading-relaxed">
      {items.map((reason) => (
        <li key={reason} className="flex gap-2.5">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-pink" aria-hidden />
          <span>{reason}</span>
        </li>
      ))}
    </ul>
  )
}

function Chip({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', className)}>{children}</span>
  )
}

function DecisionPanel({ decision }: { decision: Schemas['ConceptDecision'] }) {
  const style = DECISION[decision.status]
  return (
    <Panel className="border-l-4 border-pink">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-subtle">Recommendation</p>
        <Chip className={style.tone}>{style.label}</Chip>
      </div>
      <h3 className="mt-3 text-2xl font-bold leading-tight">{decision.headline}</h3>
      <h4 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-subtle">Why</h4>
      <Reasons items={decision.reasons} />
    </Panel>
  )
}

function vsTypicalTone(ratio: number | null): string {
  if (ratio === null) return 'bg-pill text-white'
  if (ratio >= 1.2) return 'bg-positive text-black'
  if (ratio < 0.8) return 'bg-negative text-black'
  return 'bg-white text-black'
}

function EvidenceTable({ result }: { result: Schemas['ConceptResult'] }) {
  const [open, setOpen] = useState(false)
  if (result.comparable_evidence.length === 0) return null
  return (
    <div className="mt-5 border-t border-white/5 pt-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-sm font-bold text-subtle hover:text-white"
      >
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
        Similar movies used ({result.comparable_evidence.length})
      </button>
      {open && (
        <div className="appear mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm tabular">
            <thead className="text-xs text-subtle">
              <tr>
                <th scope="col" className="py-2 pr-3 font-normal">
                  Movie
                </th>
                <th scope="col" className="px-3 py-2 text-right font-normal">
                  Similarity
                </th>
                <th scope="col" className="px-3 py-2 text-right font-normal">
                  First 6 months
                </th>
              </tr>
            </thead>
            <tbody>
              {result.comparable_evidence.map((item) => (
                <tr key={item.movie.title_id} className="border-t border-white/5">
                  <td className="py-2 pr-3">
                    <Link
                      to={`/movies/${item.movie.title_id}`}
                      className="flex items-center gap-2.5 hover:underline"
                    >
                      <Poster
                        src={item.movie.image_url}
                        title={item.movie.title}
                        className="h-9 w-6 shrink-0 rounded-sm text-[8px]"
                      />
                      <span className="min-w-0">
                        <span className="block truncate">{item.movie.title}</span>
                        <span className="text-xs text-subtle">{item.movie.year}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right">{Math.round(item.similarity * 100)}%</td>
                  <td className="px-3 py-2 text-right">
                    {item.eligible ? (
                      compact(item.first_six_month_streams)
                    ) : (
                      <span className="text-xs text-subtle">
                        {item.first_six_month_streams === null
                          ? 'No streams'
                          : 'Under 6 months of data'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-subtle">
            Only movies with 6 full months of data count toward the demand index.
          </p>
        </div>
      )}
    </div>
  )
}

function ConceptPanel({ result }: { result: Schemas['ConceptResult'] }) {
  const backed = result.demand_index !== null
  return (
    <Panel>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <div className="flex items-start gap-4">
            <span
              className={cn(
                'text-5xl font-black leading-none tabular',
                result.rank === 1 && backed ? 'text-pink' : 'text-white/40',
              )}
            >
              #{result.rank}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-subtle">
                Concept {result.index + 1}
              </p>
              <p className="mt-1 text-lg font-bold leading-snug">“{result.logline}”</p>
            </div>
          </div>
          <dl className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <dt className="text-xs text-subtle">Demand index</dt>
              <dd className="text-3xl font-bold tabular">
                {backed ? compact(result.demand_index) : '—'}
              </dd>
              <dd className="text-xs text-subtle">median streams, first 6 months</dd>
            </div>
            <div className="flex flex-wrap gap-2 pb-4">
              {result.demand_vs_typical !== null && (
                <Chip className={vsTypicalTone(result.demand_vs_typical)}>
                  {result.demand_vs_typical.toFixed(1)}× a typical movie
                </Chip>
              )}
              <Chip className="bg-pill text-white">
                {EVIDENCE[result.evidence_level]} · {result.eligible_count}{' '}
                {result.eligible_count === 1 ? 'movie' : 'movies'}
              </Chip>
              {result.crowded && <Chip className="bg-pill text-white">Crowded space</Chip>}
            </div>
          </dl>
          <h4 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-subtle">
            How we got here
          </h4>
          <Reasons items={result.reasons} />
        </div>
        <div className="space-y-6">
          {result.evidence.status === 'ok' ? (
            <ExpectedRangeChart
              range={result.evidence}
              comparables={result.comparable_evidence}
              typicalLabel="Typical movie in the catalog"
            />
          ) : (
            <p className="rounded-lg bg-black/20 p-4 text-sm text-subtle">
              Fewer than 3 similar movies have 6 full months of data, so there is no range to show.
            </p>
          )}
          {result.demand_by_country.length > 0 && (
            <div>
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-subtle">
                Where similar movies stream
              </h4>
              <BarList
                label={`Streams of similar movies by country, concept ${result.index + 1}`}
                format={percent}
                items={result.demand_by_country.map((item) => ({
                  key: item.key,
                  label: <CountryLabel country={item.key} />,
                  value: item.share_of_streams,
                }))}
              />
            </div>
          )}
        </div>
      </div>
      <EvidenceTable result={result} />
    </Panel>
  )
}

function MethodPanel({ evaluation }: { evaluation: Schemas['ConceptsEvaluation'] }) {
  const [open, setOpen] = useState(false)
  const steps = [
    'Each logline is turned into a vector with the same multilingual model as search, and compared with the genres and plot of every movie in the catalog.',
    `A movie counts as similar when its similarity stands out from the rest of the catalog (at least ${evaluation.similarity_cutoff} standard deviations above the average). Up to 20 are kept.`,
    `For each similar movie, its streams are added up over its first 6 months with data, across Argentina, Brazil, Colombia and Mexico on Amazon, Disney+, HBO Max and Netflix. Only movies whose first month is ${monthLabel(evaluation.window_start_limit)} or earlier count, so the 6 months are complete; nothing is extrapolated.`,
    'The demand index is the median of those totals, and needs at least 3 movies. The median is used so one hit cannot carry a concept.',
    `It is compared with a typical movie: the median of every catalog movie with 6 full months of data (${compact(evaluation.typical_movie)} streams). 1.2 times or more is above average; under 0.8 times is below.`,
    'Evidence level: high with 10 or more movies, medium with 5 to 9, low with 3 or 4.',
    "Concepts are ranked by demand index. The leader needs at least 1.15 times the runner-up's index to be recommended; it is a clear lead when it is also above the runner-up's upper quartile and has medium or high evidence.",
  ]
  return (
    <Panel>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span>
          <span className="block font-bold">How this was calculated</span>
          <span className="text-sm text-subtle">
            The method and the thresholds behind every number above.
          </span>
        </span>
        <ChevronDown className={cn('size-5 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ol className="appear mt-5 space-y-3 text-sm leading-relaxed">
          {steps.map((step, index) => (
            <li key={index} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-pill text-xs font-bold">
                {index + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

export function ConceptsTab() {
  const [loglines, setLoglines] = useState(['', ''])
  const evaluation = useConceptEvaluation()
  const memo = useConceptsMemo()
  const valid = loglines.map((text) => text.trim()).filter((text) => text.length >= MIN_LENGTH)

  function evaluate() {
    evaluation.mutate(valid)
    memo.mutate(valid)
  }

  const data = evaluation.data
  const results = data ? [...data.concepts].sort((a, b) => a.rank - b.rank) : []

  return (
    <div className="space-y-6">
      <ol className="grid gap-3 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.text} className="flex items-start gap-3 rounded-lg bg-raised p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-pill">
              <step.icon className="size-4" />
            </span>
            <span className="text-sm">
              <span className="block text-xs font-bold text-subtle">Step {index + 1}</span>
              {step.text}
            </span>
          </li>
        ))}
      </ol>

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
              rows={4}
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
        {loglines.length < MAX_CONCEPTS && (
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

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={evaluate}
          disabled={valid.length === 0 || evaluation.isPending}
          className="pressable rounded-full bg-pink px-6 py-3 text-sm font-bold text-black disabled:opacity-40"
        >
          {evaluation.isPending ? 'Evaluating…' : 'Evaluate concepts'}
        </button>
        <button
          type="button"
          onClick={() => setLoglines(EXAMPLES)}
          className="pressable inline-flex items-center gap-1.5 rounded-full bg-pill px-4 py-3 text-sm font-bold hover:bg-hover"
        >
          <Sparkles className="size-4" />
          Try an example
        </button>
        {valid.length === 0 && (
          <span className="text-xs text-subtle">
            Write at least one logline of {MIN_LENGTH} characters or more.
          </span>
        )}
      </div>

      {evaluation.isError && <ErrorState error={evaluation.error} onRetry={evaluate} />}

      {evaluation.isPending && (
        <div className="space-y-4" aria-label="Evaluating concepts">
          <Skeleton className="h-48" />
          <Skeleton className="h-80" />
        </div>
      )}

      {data && !evaluation.isPending && (
        <div className="stagger-children space-y-4">
          <DecisionPanel decision={data.decision} />
          {results.map((result) => (
            <ConceptPanel key={result.index} result={result} />
          ))}
          <MethodPanel evaluation={data} />
          <MemoPanel
            title="Generated summary"
            status={memo.data?.status ?? (memo.isError ? 'failed' : undefined)}
            paragraphs={[memo.data?.summary ?? '', ...(memo.data?.per_concept ?? [])].filter(
              Boolean,
            )}
            caveats={memo.data?.caveats ?? []}
          />
        </div>
      )}
    </div>
  )
}
