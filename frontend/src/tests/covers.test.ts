import type { Schemas } from '@/api/client'
import { assignCovers, bandColor, textOn } from '@/components/discover/covers'

function movie(titleId: string): Schemas['MovieSummary'] {
  return {
    title_id: titleId,
    title: titleId,
    year: 2025,
    runtime_minutes: 100,
    primary_genre: 'Drama',
    genres: ['Drama'],
    rating: 7,
    vote_count: 1000,
    image_url: null,
  }
}

function collection(
  id: string,
  section: Schemas['CollectionSection'],
  title: string,
  ids: string[],
): Schemas['CollectionSummary'] {
  return {
    collection_id: id,
    title,
    description: '',
    section,
    metric_label: 'Streams',
    preview: ids.map(movie),
  }
}

describe('assignCovers', () => {
  it('uses the next movie when the number 1 is already a cover', () => {
    const covers = assignCovers([
      collection('top-argentina', 'country', 'Top in Argentina', ['tt1', 'tt2']),
      collection('top-colombia', 'country', 'Top in Colombia', ['tt1', 'tt3']),
      collection('top-mexico', 'country', 'Top in Mexico', ['tt1', 'tt3', 'tt4']),
    ])
    expect(covers.get('top-argentina')?.title_id).toBe('tt1')
    expect(covers.get('top-colombia')?.title_id).toBe('tt3')
    expect(covers.get('top-mexico')?.title_id).toBe('tt4')
  })
})

describe('bandColor', () => {
  it('uses the flag color for country collections', () => {
    expect(
      bandColor({ collection_id: 'top-argentina', section: 'country', title: 'Top in Argentina' }),
    ).toBe('#74ACDF')
  })

  it('is stable for other collections', () => {
    const shelf = { collection_id: 'hidden-gems', section: 'now' as const, title: 'Hidden gems' }
    expect(bandColor(shelf)).toBe(bandColor(shelf))
  })

  it('picks readable text', () => {
    expect(textOn('#FCD116')).toBe('#000000')
    expect(textOn('#006847')).toBe('#ffffff')
  })
})
