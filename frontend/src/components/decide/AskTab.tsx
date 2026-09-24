import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Clapperboard,
  Code2,
  RotateCcw,
  SquarePen,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { ApiError, type Schemas } from '@/api/client'
import { useAssistant } from '@/api/queries'
import { cn } from '@/lib/cn'
import { ChatText } from './ChatText'
import { loadHistory, saveHistory, type AssistantTurn, type Turn } from './chatHistory'

const REVEAL_MAX_MS = 1500
const REVEAL_WORD_MS = 30
// Within this distance of the bottom, the view keeps following new messages.
const FOLLOW_THRESHOLD_PX = 120

const SUGGESTIONS = [
  'Which 5 movies had the most streams in Brazil in 2025?',
  'Which platform grew the most in Mexico from 2024 to 2025?',
  'How did Sony titles perform on Netflix compared with Amazon?',
  'Which country streamed the most horror movies in 2025?',
]

const STATUS: Record<Schemas['AssistantStatus'], { label: string; className: string }> = {
  answered: { label: 'Answered from data', className: 'bg-pink text-black' },
  no_data: { label: 'No data for this question', className: 'bg-white text-black' },
  out_of_scope: { label: 'Outside the dataset', className: 'bg-white text-black' },
  conversation: { label: '', className: '' },
  disabled: { label: 'Unavailable', className: 'bg-pill text-white' },
  failed: { label: 'Could not verify', className: 'bg-negative text-black' },
  rate_limited: { label: 'Limit reached', className: 'bg-pill text-white' },
}

const FALLBACK: Partial<Record<Schemas['AssistantStatus'], string>> = {
  disabled: 'I need a language model to answer. Set OPENAI_API_KEY on the server to enable me.',
  failed:
    "I couldn't check my answer against the data, so I'm not showing it. Could you try asking it another way?",
  rate_limited: "I've reached my usage limit for now. Please try again in a few minutes.",
}

const GREETING = `Hi! Ask me about streams, viewing hours, platforms, countries, genres or specific titles.

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

function AssistantBubble({ children }: { children: ReactNode }) {
  return (
    <div className="appear flex gap-3">
      <span
        className="grid size-8 shrink-0 place-items-center rounded-full bg-pink text-black"
        aria-hidden
      >
        <Clapperboard className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="w-fit max-w-full rounded-2xl rounded-tl-sm bg-raised px-4 py-3">
          {children}
        </div>
      </div>
    </div>
  )
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Shows a new reply word by word, like a chatbot typing. Restored replies appear whole.
function RevealedReply({
  reply,
  fresh,
  onStep,
}: {
  reply: Schemas['AssistantReply']
  fresh: boolean
  onStep: () => void
}) {
  const text = reply.answer ?? FALLBACK[reply.status] ?? ''
  const words = text.split(/(\s+)/)
  const [shown, setShown] = useState(() => (fresh && !reducedMotion() ? 0 : words.length))
  const done = shown >= words.length
  useEffect(() => {
    if (done) return
    const step = Math.max(Math.min(REVEAL_WORD_MS, REVEAL_MAX_MS / words.length), 8)
    const timer = setTimeout(() => setShown((count) => count + 2), step * 2)
    return () => clearTimeout(timer)
  }, [done, shown, words.length])
  useEffect(onStep, [shown, onStep])
  return (
    <>
      <ChatText text={done ? text : words.slice(0, shown).join('')} />
      {done && <Evidence evidence={reply.evidence} />}
    </>
  )
}

function AssistantMessage({
  turn,
  onRetry,
  onStep,
}: {
  turn: AssistantTurn
  onRetry: () => void
  onStep: () => void
}) {
  if (turn.role === 'error') {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-negative">{turn.message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="pressable inline-flex items-center gap-1.5 rounded-full bg-pill px-3 py-1.5 text-xs font-bold hover:bg-hover"
        >
          <RotateCcw className="size-3.5" />
          Try again
        </button>
      </div>
    )
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
      <RevealedReply reply={reply} fresh={turn.fresh ?? false} onStep={onStep} />
    </div>
  )
}

export function AskTab() {
  const [turns, setTurns] = useState<Turn[]>(loadHistory)
  const [draft, setDraft] = useState('')
  const [following, setFollowingState] = useState(false)
  // Mirrors `following` for callbacks that run between renders (scroll and reveal steps).
  const followingRef = useRef(false)
  const restored = useRef(turns.length > 0)
  const assistant = useAssistant()
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => saveHistory(turns), [turns])

  const setFollowing = useCallback((value: boolean) => {
    followingRef.current = value
    setFollowingState(value)
  }, [])

  // The bottom of the page, not the last message: the pinned input would cover the message.
  const jumpToLatest = useCallback((behavior: ScrollBehavior) => {
    const scroller = document.getElementById('main-scroll')
    scroller?.scrollTo({ top: scroller.scrollHeight, behavior })
  }, [])

  // The page scrolls inside the layout's #main-scroll, not the window.
  useEffect(() => {
    const scroller = document.getElementById('main-scroll')
    if (!scroller) return
    // A restored conversation opens at its latest message.
    if (restored.current) jumpToLatest('auto')
    const onScroll = () =>
      setFollowing(
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < FOLLOW_THRESHOLD_PX,
      )
    onScroll()
    scroller.addEventListener('scroll', onScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', onScroll)
  }, [jumpToLatest, setFollowing])

  // Follow new content only while the reader is at the bottom; never pull them away from an
  // earlier message they scrolled up to read.
  const follow = useCallback(() => {
    if (followingRef.current) jumpToLatest('auto')
  }, [jumpToLatest])

  useEffect(follow, [turns.length, assistant.isPending, follow])

  // The input grows with its text; CSS caps it at about 6 lines.
  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${input.scrollHeight}px`
  }, [draft])

  function send(question: string, history: Turn[] = turns) {
    const text = question.trim()
    if (!text || assistant.isPending) return
    const next = [...history, { role: 'user' as const, content: text }]
    setTurns(next)
    setDraft('')
    setFollowing(true)
    inputRef.current?.focus()
    // The server keeps no state: the conversation (last 12 messages) is sent each time.
    const messages: Schemas['ChatMessage'][] = next
      .flatMap((turn): Schemas['ChatMessage'][] => {
        if (turn.role === 'user') return [{ role: 'user', content: turn.content }]
        if (turn.role === 'assistant' && turn.reply.answer)
          return [{ role: 'assistant', content: turn.reply.answer.slice(0, 1000) }]
        return []
      })
      .slice(-12)
    assistant.mutate(messages, {
      onSuccess: (reply) =>
        setTurns((current) => [...current, { role: 'assistant', reply, fresh: true }]),
      onError: (error) =>
        setTurns((current) => [
          ...current,
          error instanceof ApiError && error.status === 429
            ? {
                role: 'assistant',
                reply: { status: 'rate_limited', answer: null, evidence: [] },
                fresh: true,
              }
            : {
                role: 'error',
                message: "I couldn't reach the server.",
                question: text,
              },
        ]),
    })
  }

  function retry(index: number) {
    const failed = turns[index]
    if (failed?.role !== 'error') return
    // Drop the error and the question before it; send() adds the question back.
    send(failed.question, turns.slice(0, index - 1))
  }

  function newChat() {
    setTurns([])
    setDraft('')
    inputRef.current?.focus()
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    send(draft)
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      send(draft)
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col">
      {turns.length > 0 && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={newChat}
            disabled={assistant.isPending}
            className="pressable inline-flex items-center gap-1.5 rounded-full bg-pill px-3 py-1.5 text-xs font-bold text-subtle hover:text-white disabled:opacity-40"
          >
            <SquarePen className="size-3.5" />
            New chat
          </button>
        </div>
      )}
      <div className="space-y-4" aria-live="polite">
        <AssistantBubble>
          <ChatText text={GREETING} />
        </AssistantBubble>
        {turns.length === 0 && (
          <div className="stagger-children flex flex-wrap gap-2 pl-11">
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
              className="appear ml-auto w-fit max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-pink px-4 py-2.5 text-black"
            >
              {turn.content}
            </div>
          ) : (
            <AssistantBubble key={index}>
              <AssistantMessage turn={turn} onRetry={() => retry(index)} onStep={follow} />
            </AssistantBubble>
          ),
        )}
        {assistant.isPending && (
          <AssistantBubble>
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
          </AssistantBubble>
        )}
      </div>

      <form onSubmit={onSubmit} className="sticky bottom-0 z-10 mt-6 bg-surface pb-2 pt-3">
        {!following && turns.length > 0 && (
          <button
            type="button"
            onClick={() => jumpToLatest('smooth')}
            className="appear pressable absolute -top-10 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-black shadow-lg shadow-black/40"
          >
            <ArrowDown className="size-3.5" />
            Jump to latest
          </button>
        )}
        <p className="mb-2 text-xs text-subtle">
          Answers use only the datasets: consumption for AR, BR, CO, MX on 4 platforms (Jan 2023–Jun
          2026) and one availability snapshot.
        </p>
        <div className="flex items-end gap-2 rounded-3xl bg-pill p-2 transition-shadow focus-within:ring-1 focus-within:ring-white/40">
          <label htmlFor="ask-input" className="sr-only">
            Question for the assistant
          </label>
          <textarea
            ref={inputRef}
            id="ask-input"
            value={draft}
            rows={1}
            maxLength={1000}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask a question about the data"
            className="max-h-40 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-subtle focus-visible:[box-shadow:none]"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={!draft.trim() || assistant.isPending}
            className="pressable grid size-9 shrink-0 place-items-center rounded-full bg-pink text-black transition-opacity disabled:opacity-40"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
      </form>
    </div>
  )
}
