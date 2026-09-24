import { Sparkles } from 'lucide-react'
import type { Schemas } from '@/api/client'

const UNAVAILABLE: Record<string, string> = {
  disabled: 'Summary unavailable: no language model configured.',
  failed: 'Summary unavailable right now.',
  rate_limited: 'AI summaries are paused: the usage limit was reached. Try again later.',
  insufficient_evidence: 'Not enough data to write a summary.',
}

// Generated text is always labeled and shown next to the facts it was written from.
export function Narrative({
  status,
  text,
}: {
  status: Schemas['LlmStatus']
  text?: string | null
}) {
  if (status === 'skipped') return null
  if (status !== 'ok' || !text) {
    return <p className="text-sm text-subtle">{UNAVAILABLE[status] ?? UNAVAILABLE.failed}</p>
  }
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-subtle">
        <Sparkles className="size-3.5 text-pink" /> Generated summary
      </p>
      <p className="leading-relaxed">{text}</p>
    </div>
  )
}
