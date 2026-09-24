import {
  Columns3,
  Lightbulb,
  MapPinned,
  MessageSquareText,
  Scale,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { AskTab } from '@/components/decide/AskTab'
import { CompareTab } from '@/components/decide/CompareTab'
import { ConceptsTab } from '@/components/decide/ConceptsTab'
import { GenresTab } from '@/components/decide/GenresTab'
import { LicensingTab } from '@/components/decide/LicensingTab'
import { MarketsTab } from '@/components/decide/MarketsTab'
import { cn } from '@/lib/cn'
import { useUrlState } from '@/lib/url-state'

type Tool = { id: string; question: string; description: string; icon: LucideIcon }

const TOOLS: Tool[] = [
  {
    id: 'licensing',
    question: 'Should we license this title?',
    description: 'One title, one platform, one country: evidence and a verdict.',
    icon: Scale,
  },
  {
    id: 'markets',
    question: 'Where should this title go next?',
    description: 'Every platform and country ranked for one title.',
    icon: MapPinned,
  },
  {
    id: 'compare',
    question: 'How do these titles compare?',
    description: 'Up to three titles side by side, on the same filters.',
    icon: Columns3,
  },
  {
    id: 'genres',
    question: 'Which genres are gaining?',
    description: 'Streams per title by genre, this year vs last year.',
    icon: TrendingUp,
  },
  {
    id: 'concepts',
    question: 'Which project should we pursue?',
    description: 'Compare the demand behind up to three loglines.',
    icon: Lightbulb,
  },
  {
    id: 'ask',
    question: 'Ask your own question',
    description: 'A chat that answers from the data, and says when it cannot.',
    icon: MessageSquareText,
  },
]

export function DecisionStudioPage() {
  const { get, update } = useUrlState()
  const tab = TOOLS.find((tool) => tool.id === get('tab'))?.id ?? 'licensing'

  return (
    <div className="space-y-6 pt-2">
      <header>
        <p className="text-sm font-bold text-subtle">Decision Studio</p>
        <h1 className="mt-1 text-4xl font-black tracking-tight max-sm:text-3xl">
          Evidence for the next <span className="text-brand">deal</span>
        </h1>
      </header>

      <div
        role="tablist"
        aria-label="Decision tools"
        className="-mx-1 grid grid-cols-6 gap-3 px-1 pb-1 max-2xl:grid-cols-3 max-md:flex max-md:snap-x max-md:overflow-x-auto max-md:scrollbar-none"
      >
        {TOOLS.map((tool) => {
          const selected = tab === tool.id
          return (
            <button
              key={tool.id}
              type="button"
              role="tab"
              aria-selected={selected}
              // Switching tools keeps only the tool, so each one starts clean.
              onClick={() =>
                update({
                  tab: tool.id,
                  title: undefined,
                  platform: undefined,
                  country: undefined,
                  titles: undefined,
                  countries: undefined,
                  platforms: undefined,
                  metric: undefined,
                  align: undefined,
                })
              }
              className={cn(
                'pressable flex flex-col items-start gap-3 rounded-lg p-4 text-left ring-2 ring-inset transition-colors duration-200 max-md:w-44 max-md:shrink-0 max-md:snap-start max-md:gap-2 max-md:p-3',
                selected ? 'bg-hover ring-pink' : 'bg-raised ring-transparent hover:bg-hover',
              )}
            >
              <span
                className={cn(
                  'grid size-9 place-items-center rounded-full',
                  selected ? 'bg-pink text-black' : 'bg-pill text-white',
                )}
              >
                <tool.icon className="size-4" />
              </span>
              <span className="font-bold leading-snug max-md:text-sm">{tool.question}</span>
              <span className="text-xs leading-relaxed text-subtle max-md:hidden">
                {tool.description}
              </span>
            </button>
          )
        })}
      </div>

      <div role="tabpanel" key={tab} className="appear">
        {tab === 'licensing' && <LicensingTab />}
        {tab === 'markets' && <MarketsTab />}
        {tab === 'compare' && <CompareTab />}
        {tab === 'genres' && <GenresTab />}
        {tab === 'concepts' && <ConceptsTab />}
        {tab === 'ask' && <AskTab />}
      </div>
    </div>
  )
}
