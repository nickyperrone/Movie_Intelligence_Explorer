import type { Schemas } from '@/api/client'
import { useCollections } from '@/api/queries'
import { CardRow } from '@/components/common/CardRow'
import { MovieCardSkeleton } from '@/components/common/MovieCard'
import { Pill } from '@/components/common/Pill'
import { SectionHeader } from '@/components/common/SectionHeader'
import { EmptyState, ErrorState } from '@/components/common/States'
import { CollectionCard } from '@/components/discover/CollectionCard'
import { useUrlState } from '@/lib/url-state'

type Section = Schemas['CollectionSection']

const SECTIONS: { id: Section; title: string }[] = [
  { id: 'country', title: 'Top by country' },
  { id: 'now', title: 'Right now' },
  { id: 'platform', title: 'By platform' },
  { id: 'theme', title: 'Themes' },
]

export function DiscoverPage() {
  const { get, update } = useUrlState()
  const collections = useCollections()
  const selected = SECTIONS.find((section) => section.id === get('section'))?.id
  const visible = selected ? SECTIONS.filter((section) => section.id === selected) : SECTIONS

  return (
    <div className="pt-2">
      <div className="sticky top-0 z-10 -mx-6 flex gap-2 overflow-x-auto bg-surface px-6 py-3 scrollbar-none max-sm:-mx-4 max-sm:px-4">
        <Pill active={!selected} onClick={() => update({ section: undefined })}>
          All
        </Pill>
        {SECTIONS.map((section) => (
          <Pill
            key={section.id}
            active={selected === section.id}
            onClick={() => update({ section: section.id })}
          >
            {section.title}
          </Pill>
        ))}
      </div>

      {collections.isError ? (
        <ErrorState
          className="mt-6"
          error={collections.error}
          onRetry={() => collections.refetch()}
        />
      ) : (
        visible.map((section) => {
          const items = collections.data?.collections.filter((c) => c.section === section.id) ?? []
          if (collections.data && items.length === 0) {
            return section.id === 'theme' ? (
              <section key={section.id} className="mt-8">
                <SectionHeader title={section.title} />
                <EmptyState message="Themes have not been generated yet. Run make themes with an OpenAI key." />
              </section>
            ) : null
          }
          return (
            <section key={section.id} className="mt-8">
              <SectionHeader
                title={section.title}
                action={
                  !selected && (
                    <button type="button" onClick={() => update({ section: section.id })}>
                      Show all
                    </button>
                  )
                }
              />
              {!collections.data ? (
                <CardRow label={`${section.title} loading`}>
                  {Array.from({ length: 5 }, (_, index) => (
                    <div key={index} className="w-48 shrink-0">
                      <MovieCardSkeleton />
                    </div>
                  ))}
                </CardRow>
              ) : selected ? (
                <div className="-mx-3 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
                  {items.map((collection) => (
                    <CollectionCard key={collection.collection_id} collection={collection} />
                  ))}
                </div>
              ) : (
                <CardRow label={section.title}>
                  {items.map((collection) => (
                    <CollectionCard
                      key={collection.collection_id}
                      collection={collection}
                      className="w-52 shrink-0 max-sm:w-40"
                    />
                  ))}
                </CardRow>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}
