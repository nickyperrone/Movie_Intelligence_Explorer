import { ArrowUp, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { Schemas } from '@/api/client'
import { useAssistant } from '@/api/queries'
import { cn } from '@/lib/cn'

type AssistantTurn =
  { role: 'assistant'; reply: Schemas['AssistantReply'] } | { role: 'error'; message: string }
type Turn = { role: 'user'; content: string } | AssistantTurn

const SUGGESTIONS = [
  'Which 5 movies had the most streams in Brazil in 2025?',
  '¿Qué plataforma creció más en México entre 2024 y 2025?',
  'How did Sony titles perform on Netflix compared with Amazon?',
  'What was the box office of Zootopia 2?',
]

const STATUS: Record<Schemas['AssistantStatus'], { label: string; className: string }> = {
  answered: { label: 'Answered from data', className: 'bg-pink text-black' },
  no_data: { label: 'No data for this question', className: 'bg-white text-black' },
  out_of_scope: { label: 'Outside the dataset', className: 'bg-white text-black' },
  disabled: { label: 'Unavailable', className: 'bg-pill text-white' },
  failed: { label: 'Could not verify', className: 'bg-negative text-black' },
}

const FALLBACK: Partial<Record<Schemas['AssistantStatus'], string>> = {
  disabled: 'The assistant needs a language model. Set OPENAI_API_KEY on the server to enable it.',
  failed:
    'The answer could not be checked against the data, so it is not shown. Try rephrasing the question.',
}

function Evidence({ evidence }: { evidence: Schemas['Evidence'][] }) {
  const [open, setOpen] = useState(false)
  if (evidence.length === 0) return null
  return (
    <div className="mt-3 border-t pt-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex items-center gap-1 text-xs font-bold text-subtle hover:text-white"
      >
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
        How this was answered ({evidence.length} {evidence.length === 1 ? 'query' : 'queries'})
      </button>
      {open && (
        <ol className="mt-3 space-y-4">
          {evidence.map((item, index) => (
            <li key={index} className="text-xs">
              <p className="font-bold">
                {item.purpose || (item.tool === 'run_sql' ? 'SQL query' : 'Semantic search')}
              </p>
              {item.sql && (
                <pre className="mt-1 overflow-x-auto rounded-md bg-black/50 p-3 font-mono text-[11px] leading-relaxed text-subtle">
                  {item.sql}
                </pre>
              )}
              {item.error ? (
                <p className="mt-1 text-negative">Rejected: {item.error}</p>
              ) : item.rows.length === 0 ? (
                <p className="mt-1 text-subtle">No rows returned.</p>
              ) : (
                <div className="mt-1 overflow-x-auto">
                  <table className="w-full text-left tabular">
                    <thead className="text-subtle">
                      <tr>
                        {item.columns.map((column) => (
                          <th key={column} scope="col" className="py-1 pr-4 font-normal">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {item.rows.slice(0, 20).map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-t border-white/5">
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="py-1 pr-4">
                              {cell === null ? '—' : String(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-1 text-subtle">
                    {item.row_count > 20
                      ? `Showing 20 of ${item.row_count} rows.`
                      : `${item.row_count} rows.`}
                  </p>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function AssistantMessage({ turn }: { turn: AssistantTurn }) {
  if (turn.role === 'error') {
    return <p className="text-negative">{turn.message}</p>
  }
  const { reply } = turn
  const status = STATUS[reply.status]
  return (
    <div>
      <span
        className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold', status.className)}
      >
        {status.label}
      </span>
      <p className="mt-2 whitespace-pre-line leading-relaxed">
        {reply.answer ?? FALLBACK[reply.status]}
      </p>
      <Evidence evidence={reply.evidence} />
    </div>
  )
}

export function AskTab() {
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const assistant = useAssistant()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Braces matter: newer browsers return a Promise from scrollIntoView, and an effect may only
    // return a cleanup function.
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns, assistant.isPending])

  function send(question: string) {
    const text = question.trim()
    if (!text || assistant.isPending) return
    const history = [...turns, { role: 'user' as const, content: text }]
    setTurns(history)
    setDraft('')
    // The server keeps no state: the conversation (last 12 messages) is sent each time.
    const messages: Schemas['ChatMessage'][] = history
      .flatMap((turn): Schemas['ChatMessage'][] => {
        if (turn.role === 'user') return [{ role: 'user', content: turn.content }]
        if (turn.role === 'assistant' && turn.reply.answer)
          return [{ role: 'assistant', content: turn.reply.answer.slice(0, 1000) }]
        return []
      })
      .slice(-12)
    assistant.mutate(messages, {
      onSuccess: (reply) => setTurns((current) => [...current, { role: 'assistant', reply }]),
      onError: () =>
        setTurns((current) => [
          ...current,
          { role: 'error', message: 'The assistant could not be reached. Try again.' },
        ]),
    })
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    send(draft)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send(draft)
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      <p className="text-subtle">
        Ask about the datasets in plain language. Every answer shows the queries and rows it came
        from; when the data cannot answer, the reply says so instead of guessing.
      </p>

      <div className="mt-6 space-y-4" aria-live="polite">
        {turns.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => send(suggestion)}
                className="rounded-full bg-pill px-3.5 py-2 text-left text-sm hover:bg-hover"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        {turns.map((turn, index) =>
          turn.role === 'user' ? (
            <div
              key={index}
              className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-sm bg-pink px-4 py-2.5 text-black"
            >
              {turn.content}
            </div>
          ) : (
            <div
              key={index}
              className="w-fit max-w-full rounded-2xl rounded-bl-sm bg-raised px-4 py-3"
            >
              <AssistantMessage turn={turn} />
            </div>
          ),
        )}
        {assistant.isPending && (
          <div className="w-fit rounded-2xl rounded-bl-sm bg-raised px-4 py-3 text-sm text-subtle">
            Querying the data…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="sticky bottom-0 mt-6 bg-surface pb-2 pt-3">
        <p className="mb-2 text-xs text-subtle">
          Answers use only the datasets: consumption for AR, BR, CO, MX on 4 platforms (Jan 2023–Jun
          2026) and one availability snapshot.
        </p>
        <div className="flex items-end gap-2 rounded-3xl bg-pill p-2 focus-within:ring-2 focus-within:ring-white">
          <label htmlFor="ask-input" className="sr-only">
            Question
          </label>
          <textarea
            id="ask-input"
            value={draft}
            rows={1}
            maxLength={1000}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask a question about streams, platforms, countries or titles"
            className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-subtle"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!draft.trim() || assistant.isPending}
            className="grid size-9 place-items-center rounded-full bg-pink text-black disabled:opacity-40"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </form>
    </div>
  )
}
