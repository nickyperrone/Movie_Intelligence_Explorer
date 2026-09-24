# 04 — Metrics

Every number in the app is defined here. All metrics come from `consumption` (dataset C) unless
stated otherwise.

## Scope

A metric is computed over the consumption rows that match the active filters:

- `start`, `end`: inclusive month range. Default: the last 12 months of data (2025-07 to 2026-06).
- `countries`, `platforms`: C vocabularies. Empty means all.
- `genres`: movies whose `primary_genre` is in the list.
- `distributors`: movies with at least one matching row in `title_distributors`.

Movie-level filters are applied as `title_id IN (subquery)`, never as joins that could repeat
consumption rows (`03-data.md`).

## Base metrics

| Metric | Definition | Unit |
|---|---|---|
| `streams` | `Σ streams` | streams |
| `viewing_hours` | `Σ total_minutes / 60` | hours |
| `titles_with_consumption` | number of movies whose `Σ streams` in scope is greater than 0 | titles |
| `streams_per_title` | `streams / titles_with_consumption`; null when the denominator is 0 | streams |
| `engagement` | `Σ total_minutes / Σ (streams × runtime_minutes)` over rows whose movie has a runtime; null when the denominator is 0 | ratio, shown as % |
| `share_of_streams` | `streams(group) / streams(all groups in the same scope)` | ratio, shown as % |

`engagement` estimates the share of a movie watched per stream. It is a ratio of sums, never an
average of per-row or per-title ratios, so large titles weigh in proportion to their streams. Values
above 1 are possible (rewatching, measurement differences); the API returns them unchanged and the
UI marks them.

## Comparisons

| Metric | Definition |
|---|---|
| Previous period | The same number of months immediately before `start` |
| `change_pct` | `(current − previous) / previous`. Null when `previous = 0` or when the previous period starts before 2023-01 |
| `change_pp` | For ratios (`engagement`, shares): `current − previous`, in percentage points |
| `growth_pct` (title) | Streams in the last month of the scope vs the month before: `(last − prior) / prior`. Null unless `prior ≥ 100` |
| Movers | Titles ranked by `streams(current) − streams(previous)`. Top 5 up and top 5 down |
| Share shifts | `change_pp` of `share_of_streams` per platform and per country |
| `engagement` (title ranking) | A title's engagement in the scope; null when it has fewer than 100 streams in scope |

The 100-stream floor keeps tiny titles from topping growth rankings (a move from 1 to 30 streams is
+2,900%). In the latest month the 75th percentile of streams per title is about 120.

## Activity

| Metric | Definition |
|---|---|
| Active month | A month where the movie has `Σ streams > 0` in scope |
| `first_active_month` | Earliest active month of the movie |
| `active_ratio` | Active months / months from `first_active_month` to the latest month, inclusive |

## Genre and theme rule

- Shares and totals by genre use `primary_genre`, so every stream is counted once and shares add
  up to 100%.
- A movie has several genres in `genres`. Figures by any genre in that list (used only in search
  filters) are never summed across genres.
- Theme figures use `movie_themes`, one theme per movie, so they are additive.
- Efficiency comparisons across genres and themes use `streams_per_title`, because totals mostly
  reflect how many titles each group has.

## Comparables metrics (Decision Studio)

| Metric | Definition |
|---|---|
| First-6-month streams | For a movie on a (platform, country): `m0` = its first month with streams > 0 there. Value = `Σ streams` for months `m0` to `m0 + 5` |
| Eligible | `m0 ≤ 2026-01` (latest month − 5), so the full window is observed. Movies with shorter history are excluded, not extrapolated |
| Expected range | 25th percentile, median and 75th percentile of first-6-month streams across eligible comparables. Requires at least 3 values; otherwise status `insufficient_evidence` |
| Benchmark | Median first-6-month streams of all eligible movies on the target (platform, country) |
| Demand signal | `comparables median / benchmark`: `strong` when ≥ 1.2, `moderate` when ≥ 0.8, `weak` below 0.8, `insufficient_evidence` when the expected range is unavailable. Computed in SQL/Python, never by the LLM |
| Market opportunities | For one title and its comparables: for every (C platform, C country), the expected range, benchmark, ratio `median / benchmark` and demand signal, as in the licensing assessment. Sorted by ratio descending; targets with insufficient evidence last |
| Genre momentum | Per primary genre, `streams_per_title` in the last 12 months of data and in the 12 months before, and the relative change. Computed by the frontend from two dashboard breakdowns with the same filters |
| Platform fit | For comparables, per C platform in the target country: `streams_per_title` over all months, and the number of comparables with streams there |
| Whitespace | Countries of C where at least 3 comparables have streams and the target movie has no availability row in B |
| Currently on target | Whether the movie has an availability row in the target country on any B platform mapped from the target C platform (`03-data.md`) |
| Demand index (concept) | Median, across eligible comparables, of first-6-month streams summed over all countries and platforms (window from the movie's overall `first_active_month`) |
| Saturation (concept) | Number of comparables whose `first_active_month` is within the last 12 months of data |
| Concept ranking | Concepts ordered by demand index descending; concepts without a demand index go last |

## Collections (Discover)

"Last 3 months" is 2026-04 to 2026-06. Every collection returns at most 30 movies. Ties are broken by
`streams` descending, then `title_id`.

| id | Title | Rule | Ranked by |
|---|---|---|---|
| `top-argentina` | Top in Argentina | streams in Argentina, last 3 months, > 0 | streams |
| `top-brazil` | Top in Brazil | same for Brazil | streams |
| `top-colombia` | Top in Colombia | same for Colombia | streams |
| `top-mexico` | Top in Mexico | same for Mexico | streams |
| `top-2025` | Top of 2025 | streams in 2025-01 to 2025-12, > 0 | streams |
| `rising-now` | Rising now | `growth_pct` for 2026-06 vs 2026-05, prior ≥ 100 | growth_pct |
| `evergreen` | Evergreen | ≥ 12 months since `first_active_month` | active_ratio, then streams |
| `binge-worthy` | Binge-worthy | all-time streams ≥ 5,000 and engagement ≤ 1 | engagement |
| `hidden-gems` | Hidden gems | rating ≥ 8, all-time streams below the median of movies with consumption | rating, then vote_count |
| `top-netflix`, `top-amazon`, `top-hbo-max`, `top-disney-plus` | Top on {platform} | streams on the platform, last 3 months, > 0 | streams |
| `theme-{theme_id}` | {theme name} | movies in the theme | streams in the last 12 months |

The API returns each collection's `description` in plain words, for example
"Most streams in Argentina, Apr–Jun 2026".

## Display

| Value | Format |
|---|---|
| Counts | Compact: 1,234 → 1.2K; 3,450,000 → 3.5M |
| Viewing hours | Compact with unit: 12.3K h |
| Ratios | Percent with one decimal: 72.4% |
| Changes | Signed: +12.3%, −4.1 pp. Null shows "—" with a tooltip giving the reason |
| Months | `2025-03` → "Mar 2025"; ranges "Apr–Jun 2026" |
| Rating | One decimal: 7.0 |

## Acceptance criteria

- For 10 random filter combinations, `streams` and `viewing_hours` from the API equal pandas sums
  over `dataset_C.csv` with the same filters.
- Shares by platform, country, primary genre and theme each add up to 1 (± 1e-9).
- `engagement` equals `Σ minutes / Σ (streams × runtime)` computed in pandas, and differs from the
  mean of per-title ratios on the test fixture.
- `change_pct` is null when the previous period starts before 2023-01.
- The expected range ignores comparables with `m0 > 2026-01` and returns `insufficient_evidence`
  with fewer than 3 values.
- Every collection returns at most 30 movies, all satisfying its rule.
