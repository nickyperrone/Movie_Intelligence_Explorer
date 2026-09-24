# 01 — Product

## Users

Analysts and executives at a film studio in LATAM. They use consumption data to make decisions:

- Which titles and genres perform, where, and on which platform.
- Whether to license a title to a platform in a country.
- Which shelved or pitched project has the strongest demand signal.

They are not data engineers. Every number must have a clear definition (`04-metrics.md`) and every
generated text must be traceable to the numbers it came from.

## Surfaces

A header on every page holds the app name, navigation and a semantic search box (`/` focuses it,
Enter submits).

### 1. Dashboard — `/`

Question: how is the catalog performing, and what changed?

- Filters: period (month range), countries, platforms, primary genres, distributors.
- KPIs with change vs the previous period of equal length: streams, viewing hours, titles with
  consumption, engagement.
- Monthly trend of streams or viewing hours.
- Share of streams by platform and by country. Platform × country matrix of streams per title.
- Efficiency by primary genre and by theme: streams per title.
- Top titles table, sortable by streams, viewing hours, engagement and growth. A row opens the movie.
- "What changed": biggest movers and share shifts vs the previous period, with a generated summary.

### 2. Discover — `/discover`

Question: what stands out right now, without writing a query?

- Rows of shelves with cover mosaics: top per country, top of 2025, rising now, evergreen,
  binge-worthy, hidden gems, top per platform, and one shelf per AI theme.
- Each shelf shows the rule that builds it ("Most streams in Argentina, Apr–Jun 2026").
- `/discover/:collectionId` lists the full ranking with the metric that orders it.

### 3. Search — `/search?q=...`

Question: which titles match this idea?

- Natural-language query in English or Spanish, ranked by semantic similarity.
- The LLM proposes filters (genres, years, country, platform, people). They appear as removable
  chips next to manual filter controls. Editing filters re-runs the search without the LLM.
- Each result shows poster, title, year, genres, rating and match score.

### 4. Movie — `/movies/:titleId`

Question: what is this title and how has it performed?

- Metadata: title, year, runtime, genres, rating and votes, directors, principal cast, plot, poster,
  IMDb link, full cast on demand.
- Availability: platforms, platform type, original flag and countries from the latest snapshot.
- Performance: monthly streams or viewing hours, filterable by country and platform; totals;
  breakdown by country and by platform.
- Insight: key facts and a generated summary.
- Similar titles.
- "Assess a deal" opens Decision Studio with this title selected.
- "Compare" opens Decision Studio's comparison with this title in the first column.

### 5. Decision Studio — `/decide`

Question: should we do this deal / pursue this project? The page opens with six question cards:
license a title, find the best market for a title, compare titles side by side, spot rising genres,
compare project ideas, and ask your own question (the chat).

- Best market (`/decide?tab=markets&title=...`): for one title, every consumption platform and
  country ranked by how comparable titles did there against a typical title, marking where it is
  already available.
- Compare titles (`/decide?tab=compare&titles=...`): up to 3 titles side by side, one column each,
  with the same rows in the same order so every figure lines up; one chart with a line per title,
  by calendar month or from each title's first month of data; country and platform filters apply
  to every title at once.
- Rising genres (`/decide?tab=genres`): streams per title by primary genre in the last 12 months
  vs the 12 before, optionally for one country and platform.

- Licensing assessment (`/decide?tab=licensing&title=...&platform=...&country=...`): the title's
  current availability and consumption, its comparables, the comparables' streams in their first
  6 months on the target platform and country (expected range), platform fit, whitespace, and a
  generated decision memo that can be copied as Markdown.
- Ask the data (`/decide?tab=ask`): a chat where users ask questions about the datasets in plain
  language ("Which Netflix titles grew most in Mexico in 2025?"). Every answer shows the query and
  rows it came from. When the data cannot answer the question, the reply says so and explains what
  is missing; it never estimates.
- Concept evaluator (`/decide?tab=concepts`): 1 to 3 loglines of shelved or pitched projects. For
  each: the similar catalog movies and how each did in its first 6 months, the demand index against
  a typical movie, how much evidence backs it, demand by country, and recent saturation. A decision
  computed from the data (clear lead, narrow lead, too close to call, or not enough evidence) with
  the reasons behind it, a step-by-step explanation of the method, and a generated memo that must
  agree with the decision.

## User stories

| # | As a... | I want to... | So that... |
|---|---|---|---|
| 1 | analyst | search "dark psychological thrillers about obsession" | I find titles by theme, not by keyword |
| 2 | analyst | search in Spanish | I do not have to translate my question |
| 3 | analyst | see and remove the filters the app inferred | I stay in control of the results |
| 4 | analyst | open a movie and filter its consumption by country and platform | I see where it performs |
| 5 | executive | see KPIs vs the previous period for my filters | I know if things improved |
| 6 | executive | compare genres by streams per title | catalog size does not distort the comparison |
| 7 | executive | filter the dashboard to Sony titles | I see our own portfolio |
| 8 | analyst | browse shelves like "Top in Argentina" | I spot titles without a query |
| 9 | sales | assess licensing a title to Netflix in Brazil | I have evidence for the negotiation |
| 10 | development | compare the demand signal of 3 loglines | I choose which project to revive |
| 15 | analyst | type an actor's or director's name and see their movies | I can find a talent's titles without knowing them |
| 16 | sales | see the best platform and country for a title in one list | I know where to pitch it first |
| 17 | acquisitions | see which genres are gaining streams per title | I know what to look for |
| 13 | analyst | ask a question in plain language and see the query behind the answer | I can trust or check the number |
| 14 | analyst | be told clearly when the data cannot answer | I do not act on an invented number |
| 18 | analyst | compare up to 3 titles side by side | I see which one performs better, and where |
| 11 | any user | share the URL of what I am looking at | a colleague sees the same view |
| 12 | any user | use the app when the LLM is unavailable | the core features still work |

## Out of scope

Authentication, user accounts, saving or editing data, forecasting models, availability history
(dataset B is a single snapshot), consumption outside the four countries and four platforms of
dataset C, mobile-first layouts beyond a usable single-column view.

## Acceptance criteria

- The five routes exist and are reachable from the header.
- The four example queries from the brief return relevant titles in the top 5 (`05-search.md`).
- Every page renders without an OpenAI key; LLM sections show that the summary is unavailable.
- Every view with filters can be reproduced by opening its URL.
- Asking for data outside the datasets (box office revenue, Chile consumption, 2022) returns a
  `no_data` or `out_of_scope` reply that names what is missing.
