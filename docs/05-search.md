# 05 — Search, similarity and themes

## Embedding model

`intfloat/multilingual-e5-small` through sentence-transformers.

- 384 dimensions, 512-token input, runs on CPU.
- Multilingual: queries in Spanish and Portuguese match English plots.
- e5 is trained with prefixes: documents are embedded as `passage: ...`, queries as `query: ...`.
  Leaving them out lowers quality.
- Vectors are L2-normalized, so cosine similarity is a dot product.

## Movie document

One document per movie, built in `pipeline/build_embeddings.py`:

```
passage: Title: {title}
Genres: {genres joined with ", "}
Director: {directors joined with ", "}
Plot: {plot_summary}
```

Lines with empty values are omitted.

| Field | Included | Reason |
|---|---|---|
| Title | yes | Carries meaning for many titles ("Nosferatu", "Zootopia 2") |
| Genres | yes | Plots can be 45 characters long; genres add the missing context ("animated") |
| Director | yes | Adds style signal at low cost |
| Plot | yes | Main semantic content |
| Cast | no | Dozens of names add noise to the vector. Person queries use the `people` filter |
| Year, rating, platform, country | no | Structured values; handled as filters |

Output: `data/processed/embeddings.npy` (float32, shape 1590 × 384, rows ordered by `title_id`) and
`data/processed/embedding_ids.json` (the `title_id` of each row).

## Query pipeline (`GET /api/v1/search`)

1. Validate `q`: 2 to 200 characters after trimming.
2. If `interpret=true`, call `interpret_query` (`06-llm.md`). On success it returns a
   `semantic_query` and proposed filters. Otherwise `semantic_query = q` and no proposed filters.
3. Applied filters = proposed filters, overridden field by field by any filter sent explicitly in the
   request.
4. `candidate_ids(applied filters)` returns the allowed `title_id` set (SQL). No filters = all movies.
5. Embed `query: {semantic_query}`, score every allowed movie, sort by score descending.
6. Drop results below `MIN_SEARCH_SCORE`, cut at `limit` (default 20, max 50).
7. Return results with scores rounded to 4 decimals, the interpretation and the applied filters.

An empty result list is a valid 200 response. The UI shows it as an empty state with suggestions.

### Filter semantics

| Filter | Source | Match |
|---|---|---|
| `genres` | `movies.genres` | Movie has **all** listed genres |
| `year_min`, `year_max` | `movies.year` | Inclusive range |
| `countries`, `platforms` | `availability` (B vocabularies) | One availability row matches both: "Netflix in Brazil" requires a row with `platform = Netflix` and `country = Brazil`. Any listed value matches. If only one of the two is given, only that column is checked |
| `people` | `movies.directors`, `movies.cast_names` | Case-insensitive substring match on any element. Any listed name matches |

Different filters combine with AND.

### Relevance threshold

`MIN_SEARCH_SCORE` is set from the evaluation below and stored in `app/config.py` with the date and
the evaluation result that justified it. Starting value: 0.80.

## Similar movies (`GET /movies/{id}/similar`)

Dot product between the movie's vector and all others, excluding itself. No threshold; `limit`
default 8.

## Comparables (Decision Studio)

- Licensing: candidates are movies with the same `primary_genre` and `year` within ±2 of the target,
  excluding the target. Ranked by similarity to the target vector. Top 20.
- Concepts: the logline is embedded as `query: {logline}`. Candidates are all movies. Ranked by
  similarity, top 20, only scores ≥ `MIN_SEARCH_SCORE`.

## Themes (offline)

`pipeline/build_themes.py`, run by hand (`make themes`), output reviewed and committed.

1. k-means on the normalized vectors, `random_state = 42`, `n_init = 10`.
2. k is chosen in 16..32 by the highest silhouette score (cosine).
3. For each cluster, the 10 movies closest to the centroid (title, genres, first 300 characters of the
   plot) are sent to the LLM, which returns a name (at most 4 words) and a description (at most 20
   words) (`06-llm.md`).
4. Output `data/curated/themes.json`:

```json
{
  "generator": "pipeline/build_themes.py",
  "model": "<OPENAI_MODEL>",
  "k": 24,
  "silhouette": 0.071,
  "themes": [
    { "theme_id": "t01", "name": "...", "description": "...", "title_ids": ["tt..."] }
  ]
}
```

5. A person reads every name and description before committing and edits them if needed. The commit
   message states that the names were reviewed.

## Evaluation

`backend/eval/queries.yaml` holds the evaluation set. `make eval` runs every query through the
search service with `interpret=false` (the LLM is evaluated separately), and prints per-query and
mean precision@5 and precision@10.

Relevance is decided by a rule per query, so the judgment is explicit and reproducible:

| # | Query | Relevant when |
|---|---|---|
| 1 | dark psychological thrillers about obsession | genres include Thriller, Horror or Mystery, and plot matches `obsess\|stalk\|fixat\|infatuat` |
| 2 | family movies about overcoming loss | plot matches `grie(f\|v)\|loss\|death of\|mourn\|passed away\|lost (his\|her\|their)` |
| 3 | animated adventures | genres include Animation and Adventure |
| 4 | movies about artificial intelligence | plot matches `artificial intelligence\|\bAI\b\|robot\|android\|sentient\|synthetic` |
| 5 | películas de terror sobre casas embrujadas | genres include Horror, plot matches `haunt\|ghost\|spirit\|possess` |
| 6 | documentales sobre música | genres include Documentary and Music |
| 7 | heist movies with a crew of thieves | plot matches `heist\|robbery\|\brob\b\|thie(f\|ves)\|steal` |
| 8 | space exploration and astronauts | plot matches `space\|astronaut\|planet\|galaxy` |
| 9 | true crime documentaries about serial killers | genres include Documentary, plot matches `serial killer\|murder\|killer` |
| 10 | romantic comedies at Christmas | genres include Comedy or Romance, plot matches `christmas\|holiday\|santa` |
| 11 | sports underdog stories | genres include Sport |
| 12 | zombie apocalypse | plot matches `zombie\|undead\|infected` |
| 13 | filmes de guerra | genres include War, or plot matches `\bwar\b\|soldier\|world war` |
| 14 | teenagers coming of age in high school | plot matches `teen\|high school\|coming-of-age\|adolescen` |
| 15 | documentales sobre naturaleza y animales | genres include Documentary, plot matches `nature\|wildlife\|animal\|ocean\|planet` |

Negative queries (expected to return no results above the threshold):
`quarterly tax filing spreadsheet`, `asdf qwer zxcv`, `how to fix a flat bicycle tire`.

Targets: mean precision@5 ≥ 0.70; each of queries 1–4 (from the brief) ≥ 0.60; each negative query
returns at most 2 results. The threshold is the highest value that meets these targets and still
returns at least 5 results for every positive query. Results are recorded in the README.

## Acceptance criteria

- `embeddings.npy` has shape (1590, 384) and every row has norm 1 (± 1e-4).
- Searching the exact plot of a movie returns that movie first.
- The four queries from the brief meet the precision target.
- Filter tests: "Netflix" + "Brazil" excludes a movie that is on Netflix only in Mexico and on
  another platform in Brazil; `genres=[Animation, Adventure]` excludes a movie with only Animation;
  `people=["raimi"]` returns Sam Raimi's movies.
- `similar` never returns the movie itself.
