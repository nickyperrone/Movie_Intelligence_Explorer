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
| `/decide` | `DecisionStudioPage` | `tab` (`licensing` \| `markets` \| `genres` \| `concepts` \| `ask`), `title`, `platform`, `country` |
| `*` | `NotFoundPage` | — |

`src/lib/url-state.ts` reads and writes these parameters. Filters, tabs and search text change the
URL, so the back button and shared links restore the view. Loglines are not put in the URL.

## Layout

The whole app follows the layout patterns of a music streaming desktop client:

- `AppLayout`: a fixed left sidebar (240 px, collapses to icons below 1024 px, becomes a bottom bar
  below 640 px) and a main panel with rounded corners on a black frame.
- Sidebar: a solid pink clapperboard icon (no gradient) with the app name "Movie Intelligence", and
  navigation items with icons (Dashboard, Discover,
  Search, Decision Studio). The active item is white; the others are grey and turn white on hover.
- Top bar inside the main panel: back and forward buttons (history), and a pill-shaped search input
  with a search icon. `/` focuses it unless the user is typing in a field.
- Suggestions as you type: 250 ms after the last keystroke (at least 2 characters) a dropdown under
  the search box shows up to 3 "Titles" (title matches, `/movies/lookup`), up to 3 "People"
  (`/people/lookup`; choosing one opens `/search?q=<name>&people=<name>&interpret=false`) and up to 5
  "Matches by meaning" (`/search?interpret=false`, embeddings only, tens of milliseconds, no LLM cost), and a
  last row "See all results for …". Typing never changes the page. Arrow keys move through the
  options, Enter opens the highlighted movie or, with nothing highlighted, the search page with
  `interpret=true`, which also asks the LLM for filters. Escape or a click outside closes the
  dropdown. The LLM is never called per keystroke.
- Main panel content: 24 px padding (16 px on small screens), max width 1440 px.

## Pages

### Dashboard

1. `DashboardToolbar`, sticky under the top bar on a solid background, one row of pills that
   scrolls sideways on small screens:
   - `Period` pill showing the active period ("Last 12 months", "2025", "Mar–Aug 2025"). It opens a
     popover with the presets (`Last 3 months`, `Last 6 months`, `Last 12 months` (default), each
     year, `All time`), computed from the latest month of data, and a custom From/To range.
   - Multi-select pills for countries, platforms, primary genres, themes and distributors, and a
     `Sony titles` toggle.
   - A second line: the period, the comparison period ("vs Jul 2024–Jun 2025", or "no comparison:
     the previous period starts before Jan 2023"), one removable chip per active filter, and
     "Clear all".
2. `KpiRow`: four `KpiCard`s (streams, viewing hours, titles with consumption, engagement), each with
   its change vs the previous period. A card is a button: it opens `KpiDetail`.
3. `KpiDetail`, a side panel that answers "where does this number come from":
   - The formula in words and the dataset it comes from (dataset C; distributors from dataset B).
   - Current value, previous value and change, with both periods named.
   - The same metric split by platform and by country (bars), and the 5 titles that contribute
     most (for engagement: the 5 titles with the most streams and their engagement).
   - The active filters it was computed with.
4. `TrendChart` with a `Compare` selector: `Total` (one area), `By platform` and `By country`
   (one line per value, overlaid), `Previous period` (current and previous period as two lines
   aligned by month position). A legend names every line. Metric toggle: streams or hours.
5. Two `ShareBars` side by side: share of streams by platform and by country.
6. `PlatformCountryMatrix`: platforms as rows, countries as columns, cell = streams per title.
7. Two `EfficiencyBars`: streams per title by primary genre and by theme, with the title count.
8. `TopTitlesTable`: sortable by streams, hours, engagement, growth. Shows 10 titles; "Show more"
   adds 10 more each time (or the remainder), until all titles are shown.
9. `ChangesPanel`: movers, share shifts and the generated summary.

Every panel has a `Source` button in its header that shows, in a popover, the dataset, the formula
and the grain behind the panel (text from `04-metrics.md`).

Axis labels use short numbers (`600K`, `1.2M`) and reserve enough width to never clip.

### Discover

Modeled on a music streaming home screen: dark surface, pill filters, titled rows of square covers.

- Same dark palette as the rest of the app; posters and cover bands carry the color.
- Top: pill filters `All`, `Top by country`, `Right now`, `By platform`, `Themes`. The active pill is
  filled white with dark text; the others are dark grey. The selection is kept in the URL
  (`/discover?section=country`). `All` shows every section; the others show one section.
- Each section: a large bold heading on the left ("Top by country", "Right now", "By platform",
  "Themes") and a "Show all" link on the right that selects that section's pill.
- Each section is one horizontal row of `CollectionCard`s with scroll snap (with `All`), or a
  grid (with a single section selected).
- Every cover on the page has the same size. Cards per view are the smaller of 5 (desktop), 3
  (tablet) or 2 (phone) and the number of cards in the shortest visible row, so no row ends in a
  gap; longer rows scroll by themselves while the pointer rests on
  a row's left or right edge (a soft fade marks the edge); clicking an edge moves one page; on touch
  screens rows are swiped. The grid view uses the same number of columns.
- `CollectionCard`:
  - Cover = poster of the collection's number 1 movie at the poster ratio (2:3), rounded corners.
    If an earlier collection in the page order already uses that poster, the next movie in the
    ranking is used (number 2, then 3). The collection page uses the same cover.
  - A colored band across the lower part of the cover with the collection name in bold
    ("Top in Brazil"). Country collections use the main color of the country's flag (Argentina
    `#74ACDF`, Brazil `#009C3B`, Colombia `#FCD116`, Mexico `#006847`); the others take a color from a
    fixed palette by a hash of the collection id, so it is stable across reloads. Text is black or
    white, whichever contrasts more.
  - Below the cover: the collection title (one line, truncated) and a muted subtitle listing the
    next titles ("Zootopia 2, Elio and more", two lines max).
  - On hover the card background lightens; the whole card is a link to `/discover/:collectionId`.
- `CollectionPage`, also dark: a header with the large cover, the label "Collection", the title,
  the description and the number of movies; then the ranked list as rows (rank, poster thumbnail,
  title with year and genres, metric value aligned right). A row links to the movie.

### Search

- The query comes from the top bar. When the page was opened without interpretation
  (`interpret=false`), a hint says "Press Enter to let AI infer filters". Previous results stay
  visible while new ones load.
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

The page opens with a grid of five question cards (icon, question, one-line description). The
selected card is outlined in pink and its tool renders below; the choice is kept in `tab`:

| Card | `tab` |
|---|---|
| Should we license this title? | `licensing` |
| Where should this title go next? | `markets` |
| Which genres are gaining? | `genres` |
| Which project should we pursue? | `concepts` |
| Ask your own question | `ask` |

Best market:
- A title picker, then a ranked table of the 16 platform × country targets: platform logo and flag,
  demand signal, comparables' median first-6-month streams, typical title, ratio, and an "Already
  available" tag. The top row links to the licensing assessment for that target.

Rising genres:
- Country and platform `SelectPill`s (optional). A table of primary genres: streams per title in
  the last 12 months, in the 12 months before, and the change (green up, red down), sorted by
  change. Genres with fewer than 5 titles streamed in either period are listed last and marked
  "few titles".

Licensing:
- The form reads as a sentence: "License [title] to [platform] in [country]", with the title as a
  search combobox and the platform and country as `SelectPill`s. Submitting writes the URL.
- `Verdict` at the top, in plain words and computed in the frontend from the facts (no LLM): the
  demand signal, then one sentence such as "Comparable titles reached a median of 985 streams in
  their first 6 months on Amazon in Colombia, 8.7× the typical title there (113)."
- "Already available on this platform in this country" warning when applicable.
- `ExpectedRangeChart` with an axis, a legend (dot = one comparable title, band = middle half of
  comparables, solid line = their median, dashed line = median of all titles on the target) and a
  caption with the range ("Most comparables: 450 to 1.9K streams").
- `ComparablesTable`, `PlatformFitBars` ("Where similar titles perform in {country}") and
  `WhitespaceList` ("Countries where similar titles are watched but this title is not available").
- The title's own consumption and availability in a compact side card.
- `MemoPanel`: headline, evidence, risks, caveats, "Copy as Markdown" button. Loads after the
  facts.

Concepts:
- Up to three `LoglineInput`s (textarea, 20–600 characters, counter), "Add concept", "Evaluate".
- Results: one column per concept, ordered by rank: rank, demand index, saturation, top 5
  comparables, demand by country bars. `MemoPanel` with the summary and one sentence per concept.

Ask the data:
- A chat column: messages in bubbles (user right, assistant left), a multiline input with Enter to
  send and Shift+Enter for a new line, and suggested questions as pills before the first message.
- Each assistant reply shows a status label: "Answered from data", "No data for this question",
  "Outside the dataset", "Unavailable" (disabled), "Could not verify" (failed).
- Under each reply, a collapsed "How this was answered" section lists the evidence: purpose, SQL in
  a code block, and the first 20 rows in a table with the total row count.
- A permanent note above the input: "Answers use only the datasets: consumption for AR, BR, CO, MX on
  4 platforms (Jan 2023–Jun 2026) and one availability snapshot."
- The conversation lives in component state only; reloading clears it.

## Categories are links

A genre or theme shown anywhere (movie header, cards, tables, charts, search results) is a link to
the dashboard filtered by it: `/?genres=Comedy` (primary genre) or `/?themes=t05`. The dashboard
shows that category's charts and keeps every other filter available.

## Discover: browse by genre

After the shelves, a "Browse by genre" section shows one colored tile per primary genre (icon and
name, same size, grid of 2 to 6 columns). A tile opens the dashboard filtered by that genre.

## Search examples

The example queries on the empty Search page and the example in the search box placeholder rotate
every 4 seconds with a fade, through a fixed list of 12 examples (English and Spanish). Rotation
pauses while the user hovers or types, and does not run with reduced motion.

## States

Every data view handles all of these:

| State | Rendering |
|---|---|
| Loading | Skeletons with the final layout's shape everywhere: pages loaded on demand, panels, card rows, suggestion lists, tables. No spinners |
| Refreshing | While new data for changed filters loads, the previous content stays and dims to 60% opacity |
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

Axis ticks and tooltips use `src/lib/format.ts` (`04-metrics.md`, "Display"). Colors come from the CSS
variables above. Every chart has an `aria-label` that states what it
shows.

## Data access

- `src/api/schema.d.ts` is generated from `docs/api/openapi.yaml`.
- `src/api/client.ts` creates one `openapi-fetch` client with base URL `/api/v1`.
- `src/api/queries.ts` exports one hook per endpoint (`useSearch`, `useMovie`, ...). Query keys
  include every parameter. `staleTime` 5 minutes, 1 retry, no retry on 4xx.
- Error envelopes become `ApiError` objects with `code` and `message`.
- In development Vite proxies `/api` to `http://localhost:5001` (`API_PORT`).

## Visual direction

Design patterns of a music streaming app, applied to every page. No third-party logos or brand
names are used.

| Token | Value | Use |
|---|---|---|
| `--frame` | `#000000` | Background around the sidebar and main panel |
| `--surface` | `#121212` | Main panel and sidebar |
| `--surface-raised` | `#181818` | Cards, tables, chart panels |
| `--surface-hover` | `#282828` | Card and row hover |
| `--pill` | `#2a2a2a` | Inactive pills, inputs |
| `--text` | `#ffffff` | Headings, primary text, active pill background |
| `--text-muted` | `#b3b3b3` | Subtitles, secondary text, axis labels |
| `--pink` | `#ff6fcf` | Accent: primary buttons (solid), active states, main chart series, bars |
| `--brand-gradient` | `#ffd6f0 → #ff7ad6 → #e157f5` (left to right) | Only one highlighted word per page title. Never on buttons or the logo |
| `--positive` | `#3ddc84` | Gains: positive changes and growth, always with a + sign |
| `--negative` | `#ff5c5c` | Losses: negative changes, always with a − sign; errors |
| `--warning` | `#ffa42b` | Engagement above 100%, "already available" warnings |

- Dark only. The app does not switch to a light theme.
- Typography: Inter. Section headings 24 px bold with tight letter spacing; page titles 32–48 px
  bold; card titles 16 px medium; subtitles 14 px muted. Numbers use tabular figures.
- Shapes: pills (fully rounded) for filters, chips, search input and primary buttons; 8 px radius for
  cards and covers; 4 px for poster thumbnails in lists.
- Filters on every page are pills: the active pill is white with black text, inactive pills are
  `--pill` with white text. Multi-select filters open a dark popover list.
- No native `<select>` elements: single choices use `SelectPill` and multiple choices use
  `MultiSelectPill`, both built on the same popover, with flags, platform logos and genre icons in
  the options.
- Every movie image keeps the poster ratio (2:3), including collection covers. Nothing is square.
- Cards: `--surface-raised` background, lighten to `--surface-hover` on hover, no borders.
- Rows of cards: a heading on the left and "Show all" on the right, as on Discover.
- Charts: `--pink` for the main series with a pink-to-transparent area fill, greys for secondary series, no gridlines except faint
  horizontal ones, tooltips on `--surface-hover`.
- Buttons always use solid colors. Primary actions: `--pink` background, black bold text, pill
  shape, slight scale on hover. Secondary actions: white or `--pill`.
- Page titles may highlight their key word with the gradient as text fill.
- Motion: 150–200 ms transitions on hover and focus; a 300 ms fade with a small upward slide when
  the page changes, when a panel's content appears after loading, and when a tab, tool or section
  is switched. Pressable elements scale to 97% while pressed. No motion when the system asks for
  reduced motion.
- Focus: a white ring with a dark gap, drawn with box-shadow so it follows rounded shapes.

## Accessibility

Every input has a label. Interactive elements are reachable by keyboard with a visible focus ring.
Posters have `alt` text with the movie title. Color is never the only carrier of meaning (signal
badges have text, changes have a sign).

## Acceptance criteria

- `tsc --noEmit`, `oxlint` and `vitest` pass.
- Opening any URL from the table above directly (hard reload) renders the same view.
- With the API returning an error for a section, only that section shows `ErrorState`.
- The movie page for a title without consumption shows the "No consumption" text and no chart.
- Every page works at 375 px width without horizontal scrolling of the page: filter rows and tables
  scroll inside their own container, sentence-style headers wrap, grids drop to one or two columns.
