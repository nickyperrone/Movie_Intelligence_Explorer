import { ArrowUp, ChevronDown, Clapperboard, Code2 } from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import type { Schemas } from '@/api/client'
import { useAssistant } from '@/api/queries'
import { cn } from '@/lib/cn'
import { ChatText } from './ChatText'

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
  conversation: { label: '', className: '' },
  disabled: { label: 'Unavailable', className: 'bg-pill text-white' },
  failed: { label: 'Could not verify', className: 'bg-negative text-black' },
}

const FALLBACK: Partial<Record<Schemas['AssistantStatus'], string>> = {
  disabled: 'I need a language model to answer. Set OPENAI_API_KEY on the server to enable me.',
  failed:
    "I couldn't check my answer against the data, so I'm not showing it. Could you try asking it another way?",
}

const GREETING = `Hi, I'm **Reel**, the Movie Intelligence assistant. Ask me about streams, viewing hours, platforms, countries, genres or specific titles, in English or Spanish.

I answer only from the data and show you where each number comes from. If the data can't answer something, I'll tell you. What would you like to know?`

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

function columnLabel(column: string): string {
  const words = column.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function cellText(cell: Schemas['Evidence']['rows'][number][number]): string {
  if (cell === null) return '—'
  if (typeof cell === 'number') return numberFormat.format(cell)
  return String(cell)
}

function EvidenceItem({ item }: { item: Schemas['Evidence'] }) {
  const [showQuery, setShowQuery] = useState(false)
  return (
    <li className="text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">
          {item.purpose || (item.tool === 'run_sql' ? 'Query' : 'Semantic search')}
        </p>
        {item.sql && (
          <button
            type="button"
            onClick={() => setShowQuery((value) => !value)}
            aria-expanded={showQuery}
            className="pressable inline-flex items-center gap-1 rounded-full bg-pill px-2.5 py-1 font-bold text-subtle hover:text-white"
          >
            <Code2 className="size-3.5" />
            {showQuery ? 'Hide query' : 'Show query'}
          </button>
        )}
      </div>
      {showQuery && item.sql && (
        <pre className="appear mt-2 overflow-x-auto rounded-md bg-black/50 p-3 font-mono text-[11px] leading-relaxed text-subtle">
          {item.sql}
        </pre>
      )}
      {item.error ? (
        <p className="mt-2 text-negative">This query failed and was corrected: {item.error}</p>
      ) : item.rows.length === 0 ? (
        <p className="mt-2 text-subtle">No rows returned.</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-md bg-black/25">
          <table className="w-full text-left tabular">
            <thead className="text-subtle">
              <tr>
                {item.columns.map((column) => (
                  <th key={column} scope="col" className="px-3 py-2 font-normal">
                    {columnLabel(column)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {item.rows.slice(0, 20).map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t border-white/5">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={cn('px-3 py-2', typeof cell === 'number' && 'text-right')}
                    >
                      {cellText(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 pb-2 text-subtle">
            {item.row_count > 20
              ? `Showing 20 of ${item.row_count} rows.`
              : `${item.row_count} ${item.row_count === 1 ? 'row' : 'rows'}.`}
          </p>
        </div>
      )}
    </li>
  )
}

function Evidence({ evidence }: { evidence: Schemas['Evidence'][] }) {
  const [open, setOpen] = useState(false)
  if (evidence.length === 0) return null
  return (
    <div className="mt-4 border-t pt-3">
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
        <ol className="appear mt-3 space-y-5">
          {evidence.map((item, index) => (
            <EvidenceItem key={index} item={item} />
          ))}
        </ol>
      )}
    </div>
  )
}

function ReelBubble({ children }: { children: ReactNode }) {
  return (
    <div className="appear flex gap-3">
      <span
        className="grid size-8 shrink-0 place-items-center rounded-full bg-pink text-black"
        aria-hidden
      >
        <Clapperboard className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-bold text-subtle">Reel</p>
        <div className="w-fit max-w-full rounded-2xl rounded-tl-sm bg-raised px-4 py-3">
          {children}
        </div>
      </div>
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
      {status.label && (
        <span
          className={cn(
            'mb-3 inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold',
            status.className,
          )}
        >
          {status.label}
        </span>
      )}
      <ChatText text={reply.answer ?? FALLBACK[reply.status] ?? ''} />
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
          { role: 'error', message: "I couldn't reach the server. Please try again." },
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
      <div className="space-y-4" aria-live="polite">
        <ReelBubble>
          <ChatText text={GREETING} />
        </ReelBubble>
        {turns.length === 0 && (
          <div className="flex flex-wrap gap-2 pl-11">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => send(suggestion)}
                className="pressable rounded-full bg-pill px-3.5 py-2 text-left text-sm hover:bg-hover"
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
              className="appear ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-sm bg-pink px-4 py-2.5 text-black"
            >
              {turn.content}
            </div>
          ) : (
            <ReelBubble key={index}>
              <AssistantMessage turn={turn} />
            </ReelBubble>
          ),
        )}
        {assistant.isPending && (
          <ReelBubble>
            <span className="flex items-center gap-2 text-sm text-subtle">
              Looking at the data
              <span className="flex gap-1" aria-hidden>
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="size-1.5 animate-bounce rounded-full bg-pink"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
            </span>
          </ReelBubble>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="sticky bottom-0 mt-6 bg-surface pb-2 pt-3">
        <p className="mb-2 text-xs text-subtle">
          Reel uses only the datasets: consumption for AR, BR, CO, MX on 4 platforms (Jan 2023–Jun
          2026) and one availability snapshot.
        </p>
        <div className="flex items-end gap-2 rounded-3xl bg-pill p-2 focus-within:ring-2 focus-within:ring-white">
          <label htmlFor="ask-input" className="sr-only">
            Question for Reel
          </label>
          <textarea
            id="ask-input"
            value={draft}
            rows={1}
            maxLength={1000}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask Reel about streams, platforms, countries or titles"
            className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-subtle"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!draft.trim() || assistant.isPending}
            className="pressable grid size-9 place-items-center rounded-full bg-pink text-black disabled:opacity-40"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </form>
    </div>
  )
}
