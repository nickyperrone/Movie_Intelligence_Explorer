# 07 — Frontend

React 19 + TypeScript (strict) + Vite, Tailwind CSS v4, shadcn/ui, TanStack Query, React Router,
Recharts. All UI copy in English.

## Routes and URL state

| Route | Page | URL parameters |
|---|---|---|
| `/` | `DashboardPage` | `start`, `end` (`YYYY-MM`), `countries`, `platforms`, `genres`, `distributors` (repeated), `metric` (`streams` \| `hours`), `sort` |
| `/discover` | `DiscoverPage` | `section` (`country` \| `now` \| `platform` \| `theme`) |
| `/discover/:collectionId` | `CollectionPage` | — |
| `/search` | `SearchPage` | `q`, `interpret`, `genres`, `year_min`, `year_max`, `countries`, `platforms`, `people` |
| `/movies/:titleId` | `MoviePage` | `countries`, `platforms`, `metric` |
| `/decide` | `DecisionStudioPage` | `tab` (`licensing` \| `concepts`), `title`, `platform`, `country` |
| `*` | `NotFoundPage` | — |

`src/lib/url-state.ts` reads and writes these parameters. Filters, tabs and search text change the
URL, so the back button and shared links restore the view. Loglines are not put in the URL.

## Layout

`AppLayout`: a sticky header and a centered content column (max width 1280 px, 16 px side padding
on small screens).

Header: app name "Movie Intelligence" (link to `/`), navigation (Dashboard, Discover, Search,
Decision Studio), and a search input. `/` focuses the input unless the user is typing in a field.
Enter navigates to `/search?q=...`.

## Pages

### Dashboard

1. `DashboardFilters`: month range (two selects), multi-selects for countries, platforms, genres and
   distributors, "Reset" button. The coverage note "Consumption data: 4 countries, 4 platforms" is
   shown next to the filters.
2. `KpiRow`: four `KpiCard`s (streams, viewing hours, titles with consumption, engagement), each with
   its change vs the previous period and a tooltip with the metric definition.
3. `TrendChart`: line chart, month on x, streams or hours on y (toggle).
4. Two `ShareBars` side by side: share of streams by platform and by country (horizontal bars,
   sorted).
5. `PlatformCountryMatrix`: grid table, platforms as rows, countries as columns, cell = streams per
   title, color intensity scaled per table.
6. Two `EfficiencyBars`: streams per title by primary genre and by theme, with the title count on
   each bar.
7. `TopTitlesTable`: rank, poster thumbnail, title, year, streams, hours, engagement, growth.
   Sort by clicking a column header (streams, hours, engagement, growth). 20 rows and a
   "Show more" button (offset paging). A row links to the movie.
8. `ChangesPanel`: top 5 up and top 5 down movers, share shifts, and the generated summary.

### Discover

Modeled on a music streaming home screen: dark surface, pill filters, titled rows of square covers.

- The page always uses the dark palette, independent of the system theme, so posters stand out.
- Top: pill filters `All`, `Top by country`, `Right now`, `By platform`, `Themes`. The active pill is
  filled white with dark text; the others are dark grey. The selection is kept in the URL
  (`/discover?section=country`). `All` shows every section; the others show one section.
- Each section: a large bold heading on the left ("Top by country", "Right now", "By platform",
  "Themes") and a "Show all" link on the right that selects that section's pill.
- Each section is one horizontal row of `CollectionCard`s with scroll snap (with `All`), or a
  wrapping grid (with a single section selected).
- `CollectionCard`:
  - Square cover = poster of the collection's number 1 movie, rounded corners, `object-fit: cover`.
  - A colored band across the lower part of the cover with the collection name in bold
    ("Top in Brazil"). The band color is picked from a fixed palette by a hash of the collection id,
    so it is stable across reloads.
  - Below the cover: the collection title (one line, truncated) and a muted subtitle listing the
    next titles ("Zootopia 2, Elio and more", two lines max).
  - On hover the card background lightens; the whole card is a link to `/discover/:collectionId`.
- `CollectionPage`, also dark: a header with the large cover, the label "Collection", the title,
  the description and the number of movies; then the ranked list as rows (rank, poster thumbnail,
  title with year and genres, metric value aligned right). A row links to the movie.

### Search

- A large `SearchBar` pre-filled from `q`.
- `InterpretationNote`: "Searching for: comedy" when the LLM rewrote the query; a short note when
  status is `disabled` or `failed`.
- `FilterBar`: applied filters as removable chips, and an "Add filter" popover (genres, years,
  country, platform, person). Any change sets `interpret=false` and `q=semantic_query`.
- Results as a grid of `MovieCard`s: poster, title, year, genres (max 3), rating, match score as
  a percentage.
- Empty state: "No movies match this search." with the four example queries from the brief as
  links, and a "Clear filters" button when filters are applied.
- Before any query (`/search` without `q`): the example queries as chips.

### Movie

1. `MovieHeader`: poster (fallback when missing or broken), title, year, runtime, genres, rating and
   votes, directors, principal cast, plot, IMDb link, "Show full cast" toggle, "Assess a deal"
   button → `/decide?tab=licensing&title=...`.
2. `PerformanceSection`: metric toggle, country and platform multi-selects (options from the
   response), totals, `PerformanceChart` (line over months), `BreakdownBars` by country and by
   platform. Coverage note for the four countries and platforms.
3. `AvailabilitySection`: table of offers (platform, type, original flag, countries), snapshot month
   label, and the list of countries where the movie is available.
4. `InsightPanel`: facts as a definition list, generated summary below it with its label.
5. `SimilarMovies`: horizontal row of `MovieCard`s.

### Decision Studio

Tabs "Licensing" and "Concepts".

Licensing:
- Form: `TitlePicker` (combobox backed by `/movies/lookup`), platform select (C platforms), country
  select (C countries), "Assess" button. Submitting writes the URL.
- Results: `SignalBadge` (strong, moderate, weak, insufficient evidence), "Already available on
  this platform in this country" warning when applicable, `ExpectedRangeChart` (p25–p75 band,
  median line, benchmark line, one dot per comparable), `ComparablesTable` (title, year, similarity,
  first-6-month streams), `PlatformFitBars`, `WhitespaceList`, the title's own consumption totals.
- `MemoPanel`: headline, evidence, risks, caveats, "Copy as Markdown" button. Loads after the
  facts.

Concepts:
- Up to three `LoglineInput`s (textarea, 20–600 characters, counter), "Add concept", "Evaluate".
- Results: one column per concept, ordered by rank: rank, demand index, saturation, top 5
  comparables, demand by country bars. `MemoPanel` with the summary and one sentence per concept.

## States

Every data view handles all of these:

| State | Rendering |
|---|---|
| Loading | Skeletons with the final layout's shape; no spinners for whole pages |
| Error | `ErrorState` with the error message from the envelope and a "Retry" button |
| Empty | `EmptyState` with a sentence saying what is missing and a next action |
| Missing poster / broken image | `PosterFallback`: neutral block with the title's initials |
| Missing field | "—" for scalars; the section is hidden when a list is empty and that is the only content |
| No availability | "Not available on any tracked platform in the Jun 2026 snapshot." |
| No consumption | "No consumption recorded in Argentina, Brazil, Colombia or Mexico." |
| LLM `disabled` / `failed` | Texts from `06-llm.md` |
| Unknown movie (404) | `NotFoundPage` content inside the layout |
| Engagement > 100% | Value shown with a tooltip: "Above 100%: viewers watched more minutes than the runtime per stream (rewatches)." |

## Charts

| Question | Chart |
|---|---|
| How does a value move over time? | Line (Recharts `LineChart`), months on x |
| How is a total split? | Horizontal bars sorted by value, labels with share |
| How do two dimensions interact? | Table grid with color intensity |
| Where does a value fall in a range? | Range band with median line and dots |

Axis ticks and tooltips use `src/lib/format.ts` (`04-metrics.md`, "Display"). Colors come from CSS
variables so light and dark themes both work. Every chart has an `aria-label` that states what it
shows.

## Data access

- `src/api/schema.d.ts` is generated from `docs/api/openapi.yaml`.
- `src/api/client.ts` creates one `openapi-fetch` client with base URL `/api/v1`.
- `src/api/queries.ts` exports one hook per endpoint (`useSearch`, `useMovie`, ...). Query keys
  include every parameter. `staleTime` 5 minutes, 1 retry, no retry on 4xx.
- Error envelopes become `ApiError` objects with `code` and `message`.
- In development Vite proxies `/api` to `http://localhost:8000`.

## Visual direction

- Neutral base (shadcn "zinc"), one accent color for data highlights, system light/dark theme.
- Discover and collection pages use a dark surface; posters and cover bands carry the color. The
  rest of the UI stays quiet and follows the system theme.
- Inter font via `@fontsource-variable/inter` (bundled, no external requests).
- Numbers use tabular figures in tables and KPI cards.

## Accessibility

Every input has a label. Interactive elements are reachable by keyboard with a visible focus ring.
Posters have `alt` text with the movie title. Color is never the only carrier of meaning (signal
badges have text, changes have a sign).

## Acceptance criteria

- `tsc --noEmit`, `eslint` and `vitest` pass.
- Opening any URL from the table above directly (hard reload) renders the same view.
- With the API returning an error for a section, only that section shows `ErrorState`.
- The movie page for a title without consumption shows the "No consumption" text and no chart.
- The pages work at 375 px width without horizontal scrolling of the page.
