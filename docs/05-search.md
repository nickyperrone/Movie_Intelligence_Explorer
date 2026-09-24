# 05 — Search, similarity and themes

## Embedding model

`intfloat/multilingual-e5-large` through sentence-transformers.

- 1024 dimensions, 512-token input, runs on CPU (about 15 ms per query, 30 s to embed the catalog).
- Multilingual: queries in Spanish and Portuguese match English plots.
- e5 is trained with prefixes: documents are embedded as `passage: ...`, queries as `query: ...`.
  Leaving them out lowers quality.
- Vectors are L2-normalized, so cosine similarity is a dot product.

## Movie document

One document per movie, built in `pipeline/build_embeddings.py`:

```
passage: Genres: {genres joined with ", "}
Plot: {plot_summary}
```

Lines with empty values are omitted.

| Field | Included | Reason |
|---|---|---|
| Genres | yes | Plots can be 45 characters long; genres add the missing context ("animated") |
| Plot | yes | Main semantic content |
| Title | no | Title words matched query words without matching meaning ("dark" → "Orion and the Dark", "family" → "The Carman Family Deaths") |
| Director, cast | no | Names add noise to the vector. Person queries use the `people` filter |
| Year, rating, platform, country | no | Structured values; handled as filters |

### How the model and document were chosen

Mean precision@5 on the evaluation set below, with queries 1–4 (from the brief) listed separately:

| Model | Document | Mean P@5 | Brief queries P@5 | Query latency (CPU) |
|---|---|---|---|---|
| multilingual-e5-small | title + genres + director + plot | 0.57 | 0.0 / 0.2 / 0.8 / 0.8 | 9 ms |
| multilingual-e5-small | genres + plot | 0.71 | 0.2 / 0.2 / 1.0 / 0.8 | 9 ms |
| multilingual-e5-small | plot + genres | 0.61 | 0.0 / 0.6 / 0.6 / 0.8 | 9 ms |
| multilingual-e5-base | title + genres + director + plot | 0.64 | 0.2 / 0.4 / 0.8 / 0.6 | 11 ms |
| multilingual-e5-base | genres + plot | 0.68 | 0.2 / 0.6 / 0.8 / 0.6 | 11 ms |
| multilingual-e5-large | title + genres + director + plot | 0.67 | 0.0 / 0.4 / 0.8 / 0.8 | 13 ms |
| **multilingual-e5-large** | **genres + plot** | **0.75** | 0.6 / 0.2 / 1.0 / 0.8 | 13 ms |
| multilingual-e5-large | plot + genres | 0.71 | 0.2 / 0.2 / 0.8 / 0.8 | 13 ms |

The large model needs about 2.2 GB of RAM; the server has room for it, and the quality gain on the
brief's first query (0.0–0.2 → 0.6) is the reason to pay for it.

## Query pipeline (`GET /api/v1/search`)

1. Validate `q`: 2 to 200 characters after trimming.
2. If `interpret=true`, call `interpret_query` (`06-llm.md`). On success it returns a
   `semantic_query` and proposed filters. Otherwise `semantic_query = q` and no proposed filters.
3. Applied filters = proposed filters, overridden field by field by any filter sent explicitly in the
   request.
4. `candidate_ids(applied filters)` returns the allowed `title_id` set (SQL). No filters = all movies.
5. Embed `query: {semantic_query}`, score every allowed movie, sort by score descending.
6. Without filters, drop results below the relevance cutoff (below). With filters, keep every
   candidate: the user already chose them, so they are only ranked. Cut at `limit` (default 20, max 50).
7. Return results with scores rounded to 4 decimals, the interpretation and the applied filters.

An empty result list is a valid 200 response. The UI shows it as an empty state with suggestions.

### People

- `GET /people/lookup?q=` returns directors and cast members whose name contains `q`
  (case-insensitive), with their role(s) and number of movies; names starting with `q` first, then
  by number of movies.
- If `q` is exactly the name of a director or cast member (case-insensitive) and no `people` filter
  was sent or proposed, the search applies `people=[that name]` itself. This works without the LLM.

### Filter semantics

| Filter | Source | Match |
|---|---|---|
| `genres` | `movies.genres` | Movie has **all** listed genres |
| `year_min`, `year_max` | `movies.year` | Inclusive range |
| `countries`, `platforms` | `availability` (B vocabularies) | One availability row matches both: "Netflix in Brazil" requires a row with `platform = Netflix` and `country = Brazil`. Any listed value matches. If only one of the two is given, only that column is checked |
| `people` | `movies.directors`, `movies.cast_names` | Case-insensitive substring match on any element. Any listed name matches |

Different filters combine with AND.

### Relevance threshold

e5 scores for any text fall in a narrow band (about 0.75–0.85), so an absolute cutoff does not work:
at 0.78 nonsense queries still return 50 results, at 0.80 some real queries return none.

The cutoff is relative to each query: a movie is kept when its score is at least
`MIN_RELEVANCE_Z` standard deviations above the mean score of the whole catalog for that query.
`MIN_RELEVANCE_Z = 2.5`, stored in `app/config.py`.

Known limitation: nonsense or very generic queries ("how to fix a flat bicycle tire", "the") still
return a few weak matches, because some movie always stands out a little. With the LLM enabled, the
interpreted `semantic_query` reduces this; without it, the UI shows the match score so users can
judge.

## Similar movies (`GET /movies/{id}/similar`)

Dot product between the movie's vector and all others, excluding itself. No threshold; `limit`
default 8.

## Comparables (Decision Studio)

- Licensing: candidates are movies with the same `primary_genre` and `year` within ±2 of the target,
  excluding the target. Ranked by similarity to the target vector. Top 20.
- Concepts: the logline is embedded as `query: {logline}`. Candidates are all movies. Ranked by
  similarity, top 20, only results above `MIN_RELEVANCE_Z`.

## Themes (offline)

`pipeline/build_themes.py`, run by hand (`make themes`), output reviewed and committed.

1. k-means on the normalized vectors, `random_state = 42`, `n_init = 10`.
2. k is chosen in 16..32 by the highest silhouette score (cosine).
3. For each cluster, the 10 movies closest to the centroid (title, genres, first 300 characters of the
   plot) are named: either by the LLM (`make themes`, `06-llm.md`), or by a person with
   `--names data/curated/theme_names.json` (a list of `{name, description}` in cluster order;
   `--show` prints each cluster's movies to write it). Names: at most 4 words; descriptions: at most
   20 words. `themes.json` records which one was used in `named_by`.
4. Output `data/curated/themes.json`:

```json
{
  "generator": "pipeline/build_themes.py",
  "named_by": "<OPENAI_MODEL> | reviewer",
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

Targets: mean precision@5 ≥ 0.70; each of queries 3–4 (from the brief) ≥ 0.80; every positive
query returns at least 5 results above the cutoff. Negative queries are reported, not gated (see the
limitation above). Results are recorded in the README.

## Acceptance criteria

- `embeddings.npy` has shape (1590, 1024) and every row has norm 1 (± 1e-4).
- Searching the exact plot of a movie returns that movie first.
- The four queries from the brief meet the precision target.
- Filter tests: "Netflix" + "Brazil" excludes a movie that is on Netflix only in Mexico and on
  another platform in Brazil; `genres=[Animation, Adventure]` excludes a movie with only Animation;
  `people=["raimi"]` returns Sam Raimi's movies.
- `similar` never returns the movie itself.
