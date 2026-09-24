// Plain-language provenance for each dashboard panel, following docs/04-metrics.md.
export const SOURCES = {
  trend:
    'Monthly consumption (dataset C): sum of streams, or of viewing minutes divided by 60, per month in the period, for the selected countries, platforms, primary genres and distributors. Months without rows count as zero.',
  shares:
    'Dataset C: streams of each platform or country divided by all streams in the same filters. Shares add up to 100%.',
  matrix:
    'Dataset C: streams divided by the number of movies with at least one stream, for each platform and country in the period.',
  genres:
    'Dataset C joined to each movie’s primary genre (dataset A). Streams per title = streams divided by movies with streams, so large genres are not favored by size alone.',
  themes:
    'Themes group movies by the meaning of their plots (embeddings + k-means), named by an LLM and reviewed by hand. Streams per title as in genres.',
  titles:
    'Dataset C per movie in the period. Engagement = viewing minutes ÷ (streams × runtime), shown for titles with 100+ streams. Growth compares the last month of the period with the month before, for titles with 100+ streams in that month.',
  changes:
    'Dataset C: each title’s streams in this period minus the previous period of equal length. Share shifts compare each platform’s and country’s share of streams between the two periods.',
} as const
