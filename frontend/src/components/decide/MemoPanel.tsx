import { Check, Copy, Sparkles } from 'lucide-react'
import { useState } from 'react'
import type { Schemas } from '@/api/client'
import { Panel } from '@/components/common/States'
import { Skeleton } from '@/components/ui/skeleton'

const UNAVAILABLE: Record<string, string> = {
  disabled:
    'Memo unavailable: no language model configured. The facts above are complete without it.',
  failed: 'Memo unavailable right now. The facts above are complete without it.',
  insufficient_evidence:
    'No memo: there are not enough comparable titles with a full 6-month window.',
}

type MemoPanelProps = {
  title: string
  status: Schemas['LlmStatus'] | undefined
  headline?: string | null
  paragraphs?: string[]
  lists?: { title: string; items: string[] }[]
  caveats: string[]
}

function toMarkdown({
  title,
  headline,
  paragraphs = [],
  lists = [],
  caveats,
}: MemoPanelProps): string {
  return [
    `# ${title}`,
    headline ? `**${headline}**` : '',
    ...paragraphs,
    ...lists.flatMap((list) => [`## ${list.title}`, ...list.items.map((item) => `- ${item}`)]),
    '## Caveats',
    ...caveats.map((caveat) => `- ${caveat}`),
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function MemoPanel(props: MemoPanelProps) {
  const { status, headline, paragraphs = [], lists = [], caveats } = props
  const [copied, setCopied] = useState(false)

  return (
    <Panel
      title="Decision memo"
      aside={
        status === 'ok' && (
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(toMarkdown(props))
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-pill px-3 py-1.5 text-xs font-bold hover:bg-hover"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? 'Copied' : 'Copy as Markdown'}
          </button>
        )
      }
    >
      {status === undefined ? (
        <div className="space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ) : status === 'ok' ? (
        <div className="space-y-4">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-subtle">
            <Sparkles className="size-3.5 text-pink" /> Generated from the facts on this page
          </p>
          {headline && <p className="text-xl font-bold">{headline}</p>}
          {paragraphs.map((paragraph) => (
            <p key={paragraph} className="leading-relaxed">
              {paragraph}
            </p>
          ))}
          {lists.map((list) => (
            <div key={list.title}>
              <h4 className="mb-1 text-sm font-bold text-subtle">{list.title}</h4>
              <ul className="list-disc space-y-1 pl-5">
                {list.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-subtle">{UNAVAILABLE[status] ?? UNAVAILABLE.failed}</p>
      )}
      {status !== undefined && (
        <ul className="mt-5 space-y-1 border-t pt-4 text-xs text-subtle">
          {caveats.map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
