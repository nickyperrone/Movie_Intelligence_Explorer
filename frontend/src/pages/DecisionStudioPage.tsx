import { Pill } from '@/components/common/Pill'
import { AskTab } from '@/components/decide/AskTab'
import { ConceptsTab } from '@/components/decide/ConceptsTab'
import { LicensingTab } from '@/components/decide/LicensingTab'
import { useUrlState } from '@/lib/url-state'

const TABS = [
  { id: 'licensing', label: 'Licensing' },
  { id: 'concepts', label: 'Concepts' },
  { id: 'ask', label: 'Ask the data' },
] as const

export function DecisionStudioPage() {
  const { get, update } = useUrlState()
  const tab = TABS.find((item) => item.id === get('tab'))?.id ?? 'licensing'
  return (
    <div className="space-y-6 pt-2">
      <header>
        <p className="text-sm font-bold text-subtle">Decision Studio</p>
        <h1 className="mt-1 text-4xl font-black tracking-tight max-sm:text-3xl">
          Evidence for the next <span className="text-brand">deal</span>
        </h1>
      </header>
      <div role="tablist" aria-label="Decision tools" className="flex gap-2">
        {TABS.map((item) => (
          <Pill
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            active={tab === item.id}
            onClick={() => update({ tab: item.id === 'licensing' ? undefined : item.id })}
          >
            {item.label}
          </Pill>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'licensing' && <LicensingTab />}
        {tab === 'concepts' && <ConceptsTab />}
        {tab === 'ask' && <AskTab />}
      </div>
    </div>
  )
}
