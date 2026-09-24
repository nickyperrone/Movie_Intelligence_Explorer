# 03 — Data

## Sources

| File | Dataset | Grain | Rows |
|---|---|---|---|
| `data/raw/dataset_A.csv` | Movie metadata | one row per movie | 1,590 |
| `data/raw/dataset_B.csv` | Streaming availability, single snapshot (2026-06) | movie × country × platform × platform type | 10,358 |
| `data/raw/dataset_C.csv` | Monthly consumption, 2023-01 to 2026-06 | movie × month × country × platform | 62,022 |

All files are UTF-8 with a byte order mark (read with `utf-8-sig`).

## Observed quirks

| Quirk | Handling |
|---|---|
| The join key is `TITLE_ID` in A, `IMDB_ID` in B and `imdb_id` in C | Renamed to `title_id` everywhere |
| C has lowercase column names, A and B uppercase | All columns lowercased |
| Metrics in C are floats with integer values (`179.0`) | Cast to `BIGINT`; the build fails if a value has a fractional part |
| Ratings are whole numbers from 2 to 9 | Stored as `DOUBLE`, displayed with one decimal |
| B and C use different platform names (`Amazon` in C, `Amazon Prime Video` and `Amazon Other` in B) | Availability features use B vocabularies; consumption features use C vocabularies. One explicit mapping, used only to check whether a title is already on a consumption platform (see below) |
| B covers 8 countries and 19 platforms; C covers 4 countries (Argentina, Brazil, Colombia, Mexico) and 4 platforms (Amazon, Disney+, HBO Max, Netflix) | Shown in the UI as the coverage of each section |
| 1,254 rows in C have `streams = 0`, 75 of them with `total_minutes > 0` | Kept as measured. They add nothing to sums. They do not count as active months |
| 857 movies have months without rows inside their consumption range | Series are gap-filled with 0 (see below) |
| `ORIGINAL_FLAG` uses the literal `Not An Original` | `is_original = original_flag <> 'Not An Original'` |
| `PARENT_DISTRIBUTOR` is set per availability row, not per movie | A movie's distributors are the distinct non-null values across its B rows |
| Some text fields are empty or missing | Empty strings become `NULL`; list fields become empty lists |

## Tables (`data/processed/movies.duckdb`)

### `movies` — one row per movie (A)

| Column | Type | Source | Notes |
|---|---|---|---|
| `title_id` | VARCHAR, PK | `TITLE_ID` | `^tt\d+$` |
| `title` | VARCHAR | `ORIGINAL_TITLE` | |
| `year` | INTEGER | `YEAR` | 2023–2026 |
| `runtime_minutes` | INTEGER NULL | `RUNTIME_MINUTES` | |
| `rating` | DOUBLE NULL | `RATING_VALUE` | |
| `vote_count` | BIGINT NULL | `RATING_VOTE_COUNT` | |
| `title_url` | VARCHAR NULL | `IMDB_URL` | |
| `image_url` | VARCHAR NULL | `IMAGE_URL` | |
| `primary_genre` | VARCHAR NULL | `PRIMARY_GENRE` | |
| `genres` | VARCHAR[] | `GENRES` split on `,`, trimmed | `[]` when missing |
| `directors` | VARCHAR[] | `DIRECTORS` split | |
| `principal_cast` | VARCHAR[] | `PRINCIPAL_CAST` split | at most 8 |
| `cast_names` | VARCHAR[] | `CAST_NAMES` split | `cast` is a SQL keyword |
| `plot_summary` | VARCHAR NULL | `PLOT_SUMMARY` | |

### `availability` — one row per movie × country × platform × platform type (B)

| Column | Type | Source |
|---|---|---|
| `title_id` | VARCHAR | `IMDB_ID` |
| `listed_title` | VARCHAR NULL | `AMPERE_TITLE` (may differ from `movies.title`) |
| `country` | VARCHAR | `COUNTRY` |
| `platform` | VARCHAR | `PLATFORM` |
| `platform_type` | VARCHAR | `PLATFORM_TYPE` uppercased: `SVOD` or `AVOD` |
| `original_flag` | VARCHAR NULL | `ORIGINAL_FLAG` |
| `is_original` | BOOLEAN | derived |
| `original_platform` | VARCHAR NULL | `ORIGINAL_PLATFORM` |
| `parent_distributor` | VARCHAR NULL | `PARENT_DISTRIBUTOR` |
| `snapshot_month` | DATE | `MONTH_YEAR` |

### `consumption` — one row per movie × month × country × platform (C)

| Column | Type | Source |
|---|---|---|
| `title_id` | VARCHAR | `imdb_id` |
| `month` | DATE (first day of month) | `month` |
| `country` | VARCHAR | `country` |
| `platform` | VARCHAR | `platform` |
| `streams` | BIGINT | `streams` |
| `total_minutes` | BIGINT | `total_minutes` |

### `title_distributors` — one row per movie × distributor

Distinct `(title_id, parent_distributor)` from `availability` where the distributor is not null.

### `themes` and `movie_themes`

Loaded from `data/curated/themes.json` (`05-search.md`).

- `themes(theme_id VARCHAR PK, name VARCHAR, description VARCHAR)`
- `movie_themes(title_id VARCHAR PK, theme_id VARCHAR)` — every movie has exactly one theme.

If the file is missing, both tables are created empty and theme features return empty lists.

## Validations (the build fails if any is violated)

1. `movies.title_id` is unique and matches `^tt\d+$`.
2. `availability` has no duplicates on `(title_id, country, platform, platform_type)`.
3. `consumption` has no duplicates on `(title_id, month, country, platform)`.
4. Every `title_id` in `availability` and `consumption` exists in `movies`.
5. `streams` and `total_minutes` are non-negative integers.
6. `platform_type` is `SVOD` or `AVOD`.
7. `consumption.country` values are a subset of `availability.country` values.
8. When themes are present, every movie has exactly one theme and every theme id exists.

## Integration rules

- Aggregations run on one table at a time, at that table's grain. `availability` and `consumption`
  are never joined row by row: a movie with 5 availability rows in Brazil would multiply its
  Brazilian streams by 5.
- When a query needs both, each side is reduced to one row per `title_id` first (for example, "is
  available on Netflix in Brazil" as a boolean) and then joined on `title_id`.
- `movies` joins to either side on `title_id` (one-to-many, no duplication of consumption rows).
- Distributor filters use `title_distributors` through `title_id IN (...)`, never a join that could
  duplicate consumption rows.
- Series are gap-filled: for the filtered rows, every month between the first and last month present
  is returned; months without rows have `streams = 0` and `total_minutes = 0`.
- Consumption-to-availability platform mapping, used only by the licensing assessment:

  | C platform | B platforms |
  |---|---|
  | Amazon | Amazon Prime Video, Amazon Other |
  | Disney+ | Disney+ |
  | HBO Max | HBO Max |
  | Netflix | Netflix |

- The latest month of data is `MAX(consumption.month)` (2026-06). Relative windows ("last 3 months")
  are computed from it, never from the current date.

## Acceptance criteria

- `make data` prints `movies: 1,590`, `availability: 10,358`, `consumption: 62,022`.
- Each validation has a test that feeds a crafted invalid frame and expects the build to fail.
- `SUM(streams)` in `consumption` equals the sum of `streams` in `dataset_C.csv`.
- A test confirms that a movie with multiple availability rows in a country reports the same total
  streams as the raw CSV.
