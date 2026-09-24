import type { Schemas } from '@/api/client'

type Movie = Schemas['MovieSummary']

// Walks the collections in page order; when a collection's number 1 poster is already used as a
// cover, the next movie in its ranking is used instead.
export function assignCovers(
  collections: Schemas['CollectionSummary'][],
): Map<string, Movie | undefined> {
  const used = new Set<string>()
  const covers = new Map<string, Movie | undefined>()
  for (const collection of collections) {
    const cover =
      collection.preview.find((movie) => !used.has(movie.title_id)) ?? collection.preview[0]
    if (cover) used.add(cover.title_id)
    covers.set(collection.collection_id, cover)
  }
  return covers
}

const FLAG_COLORS: Record<string, string> = {
  Argentina: '#74ACDF',
  Brazil: '#009C3B',
  Colombia: '#FCD116',
  Mexico: '#006847',
}

const PALETTE = [
  '#ff8a7a',
  '#f573c7',
  '#4f9cf9',
  '#c7c9f9',
  '#f7d154',
  '#7ee2b8',
  '#ffa05c',
  '#b490f5',
]

export function bandColor(
  collection: Pick<Schemas['CollectionSummary'], 'collection_id' | 'section' | 'title'>,
): string {
  if (collection.section === 'country') {
    const country = collection.title.replace(/^Top in /, '')
    if (FLAG_COLORS[country]) return FLAG_COLORS[country]
  }
  let hash = 0
  for (const char of collection.collection_id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

export function textOn(background: string): string {
  const value = Number.parseInt(background.slice(1), 16)
  const luminance =
    0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255)
  return luminance > 150 ? '#000000' : '#ffffff'
}
