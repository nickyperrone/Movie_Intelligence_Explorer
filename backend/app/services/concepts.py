"""Demand evidence for project loglines, and the decision between them (docs/04-metrics.md).

The reasons and the decision are written here from computed figures, not by the LLM: they work
without an API key, and every number in them comes straight from the data.
"""

from functools import lru_cache
from statistics import median

from app import api_models as m
from app.config import settings
from app.db import fetch_all
from app.services import display, llm
from app.services.comparables import (
    COMPARABLE_COUNT,
    MIN_EVIDENCE,
    MODERATE_RATIO,
    STRONG_RATIO,
    eligibility_cutoff,
    expected_range,
    first_six_months,
)
from app.services.dashboard import data_months
from app.services.movies import summaries
from app.services.scope import shift_months
from app.services.search import search_index

HIGH_EVIDENCE = 10
MEDIUM_EVIDENCE = 5
# Below this ratio between the two best demand indexes, the ranking is not a recommendation.
TOO_CLOSE_RATIO = 1.15
CROWDED_MIN = 3
ORDINALS = {1: "first", 2: "second", 3: "third"}


@lru_cache(maxsize=1)
def typical_movie() -> float | None:
    cutoff = eligibility_cutoff()
    values = [w.streams for w in first_six_months(None).values() if w.first_month <= cutoff]
    return float(median(values)) if values else None


def evidence_level(eligible_count: int) -> m.EvidenceLevel:
    if eligible_count >= HIGH_EVIDENCE:
        return m.EvidenceLevel("high")
    if eligible_count >= MEDIUM_EVIDENCE:
        return m.EvidenceLevel("medium")
    if eligible_count >= MIN_EVIDENCE:
        return m.EvidenceLevel("low")
    return m.EvidenceLevel("insufficient_evidence")


def name(result: m.ConceptResult) -> str:
    return f"Concept {result.index + 1}"


def times(ratio: float) -> str:
    return f"{ratio:.1f} times"


def concept_reasons(
    comparables: list[m.Comparable],
    evidence: m.ExpectedRange,
    by_country: list[m.ShareItem],
    saturation: int,
    crowded: bool,
) -> list[str]:
    if not comparables:
        return [
            "No catalog movie is close enough in meaning to this logline to use as evidence. "
            "Describe the plot, setting and tone in more detail."
        ]
    closest = comparables[0]
    reasons = [
        f"{len(comparables)} catalog movies are close in meaning to this logline; the closest is "
        f"{closest.movie.title} ({round(closest.similarity * 100)}% similar)."
    ]
    if evidence.status == "insufficient_evidence":
        reasons.append(
            f"Only {evidence.eligible_count} of them have 6 full months of streaming data, and at "
            f"least {MIN_EVIDENCE} are needed, so demand cannot be estimated."
        )
        return reasons
    reasons.append(
        f"{evidence.eligible_count} of them have 6 full months of streaming data. Their median is "
        f"{display.compact(evidence.median)} streams in the first 6 months; the middle half "
        f"reached {display.compact(evidence.p25)} to {display.compact(evidence.p75)}."
    )
    if evidence.median is not None and evidence.benchmark:
        ratio = evidence.median / evidence.benchmark
        level = (
            "above" if ratio >= STRONG_RATIO else "close to" if ratio >= MODERATE_RATIO else "below"
        )
        reasons.append(
            f"That is {times(ratio)} a typical movie in the catalog "
            f"({display.compact(evidence.benchmark)}): demand {level} average."
        )
    if by_country:
        top = by_country[0]
        reasons.append(
            f"Most of their streams come from {top.key} "
            f"({display.percent(top.share_of_streams)} of the total)."
        )
    if crowded:
        reasons.append(
            f"{saturation} of the {len(comparables)} similar movies launched in the last 12 "
            "months: a crowded space."
        )
    elif saturation == 0:
        reasons.append("None of the similar movies launched in the last 12 months.")
    else:
        reasons.append(
            f"{saturation} of the {len(comparables)} similar movies launched in the last 12 months."
        )
    return reasons


def concept_result(index: int, logline: str, typical: float | None) -> m.ConceptResult:
    search = search_index()
    ranked = search.rank_vector(
        search.embed_query(logline), limit=COMPARABLE_COUNT, min_z=settings.min_relevance_z
    )
    ids = [tid for tid, _ in ranked]
    windows = first_six_months(ids) if ids else {}
    cutoff = eligibility_cutoff()
    movies = summaries(ids)
    comparables = [
        m.Comparable(
            movie=movies[tid],
            similarity=score,
            first_six_month_streams=windows[tid].streams if tid in windows else None,
            eligible=tid in windows and windows[tid].first_month <= cutoff,
        )
        for tid, score in ranked
    ]
    values = [c.first_six_month_streams for c in comparables if c.eligible]
    evidence = expected_range([v for v in values if v is not None], typical)

    recent_start = shift_months(data_months()[1], -11)
    saturation = sum(w.first_month >= recent_start for w in windows.values())
    crowded = saturation >= CROWDED_MIN and saturation * 2 >= len(ranked)

    rows = fetch_all(
        """
        SELECT country AS key, sum(streams) AS streams, sum(total_minutes) AS minutes
        FROM consumption WHERE list_contains(?, title_id)
        GROUP BY country ORDER BY streams DESC
        """,
        [ids],
    )
    total = sum(row["streams"] for row in rows)
    by_country = [
        m.ShareItem(
            key=row["key"],
            streams=row["streams"],
            viewing_hours=row["minutes"] / 60,
            share_of_streams=row["streams"] / total if total else 0,
        )
        for row in rows
    ]
    return m.ConceptResult(
        index=index,
        logline=logline,
        rank=1,
        demand_index=evidence.median,
        eligible_count=evidence.eligible_count,
        saturation=saturation,
        comparables=[m.ScoredMovie(movie=movies[tid], score=score) for tid, score in ranked],
        demand_by_country=by_country,
        evidence=evidence,
        demand_vs_typical=evidence.median / typical if evidence.median and typical else None,
        evidence_level=evidence_level(evidence.eligible_count),
        crowded=crowded,
        comparable_evidence=comparables,
        reasons=concept_reasons(comparables, evidence, by_country, saturation, crowded),
    )


def decide(results: list[m.ConceptResult]) -> m.ConceptDecision:
    ranked = sorted(results, key=lambda r: r.rank)
    backed = [r for r in ranked if r.demand_index is not None]
    missing = [
        f"{name(r)} has too few similar movies with 6 full months of data to compare."
        for r in ranked
        if r.demand_index is None
    ]
    if not backed:
        return m.ConceptDecision(
            status="insufficient_evidence",
            headline="Not enough evidence to recommend a concept.",
            reasons=[
                f"No concept has at least {MIN_EVIDENCE} similar movies with 6 full months of "
                "streaming data.",
                "Describe the projects in more detail, or compare ideas closer to what the catalog "
                "already has.",
            ],
        )

    top = backed[0]
    level = top.evidence_level.root
    if len(backed) == 1:
        reasons = [
            f"{name(top)}'s similar movies reached a median of {display.compact(top.demand_index)} "
            "streams in their first 6 months."
        ]
        if top.demand_vs_typical is not None:
            reasons.append(
                f"That is {times(top.demand_vs_typical)} a typical movie in the catalog "
                f"({display.compact(top.evidence.benchmark)})."
            )
        reasons.append(
            f"It rests on {top.eligible_count} movies with full data ({level} evidence)."
        )
        headline = (
            f"{name(top)} is the only concept with enough evidence."
            if len(results) > 1
            else f"{name(top)} has {level} evidence behind its demand estimate."
        )
        return m.ConceptDecision(status="single", headline=headline, reasons=reasons + missing)

    second = backed[1]
    ratio = top.demand_index / second.demand_index if second.demand_index else float("inf")
    above_quartile = second.evidence.p75 is not None and top.demand_index > second.evidence.p75
    if ratio < TOO_CLOSE_RATIO:
        status = "too_close"
        headline = f"Too close to call between {name(top)} and {name(second)}."
    elif above_quartile and level in ("high", "medium"):
        status = "clear_lead"
        headline = f"Pursue {name(top)}: its similar movies clearly did better."
    else:
        status = "narrow_lead"
        headline = f"{name(top)} leads, but the evidence is not decisive."

    reasons = [
        f"{name(top)}'s similar movies reached a median of {display.compact(top.demand_index)} "
        f"streams in their first 6 months, {times(ratio)} {name(second)} "
        f"({display.compact(second.demand_index)})."
    ]
    if above_quartile:
        reasons.append(
            f"That median is above {name(second)}'s upper quartile "
            f"({display.compact(second.evidence.p75)}): most of {name(second)}'s similar movies "
            "did worse."
        )
    else:
        reasons.append(
            f"The ranges overlap: {name(second)}'s upper quartile "
            f"({display.compact(second.evidence.p75)}) is above {name(top)}'s median, so a few "
            "titles could explain the gap."
        )
    reasons.append(
        f"{name(top)} rests on {top.eligible_count} movies with full data ({level} evidence)."
    )
    if top.crowded:
        reasons.append(
            f"{name(top)} enters a crowded space: {top.saturation} of its similar movies launched "
            "in the last 12 months."
        )
    reasons += [
        f"{name(r)} ranks {ORDINALS[r.rank]} with a median of {display.compact(r.demand_index)}."
        for r in backed[2:]
    ]
    return m.ConceptDecision(status=status, headline=headline, reasons=reasons + missing)


def evaluate_concepts(loglines: list[str]) -> m.ConceptsEvaluation:
    typical = typical_movie()
    results = [concept_result(index, logline, typical) for index, logline in enumerate(loglines)]
    order = sorted(results, key=lambda r: (r.demand_index is None, -(r.demand_index or 0), r.index))
    for rank, result in enumerate(order, start=1):
        result.rank = rank
    return m.ConceptsEvaluation(
        concepts=results,
        decision=decide(results),
        typical_movie=typical,
        window_start_limit=display.month_key(eligibility_cutoff()),
        similarity_cutoff=settings.min_relevance_z,
    )


def concepts_memo(loglines: list[str]) -> m.ConceptsMemo:
    evaluation = evaluate_concepts(loglines)
    if evaluation.decision.status == "insufficient_evidence":
        return m.ConceptsMemo(
            status=m.LlmStatus("insufficient_evidence"),
            summary=None,
            per_concept=[],
            caveats=llm.DECISION_CAVEATS,
        )
    facts = {
        "decision": evaluation.decision.headline,
        "decision_reasons": evaluation.decision.reasons,
        "concepts": [
            {
                "logline": result.logline,
                "rank": str(result.rank),
                "demand_index_median_first_6_month_streams": display.compact(result.demand_index),
                "comparables_with_full_window": str(result.eligible_count),
                "evidence_level": result.evidence_level.root,
                "comparables_released_in_last_12_months": str(result.saturation),
                "closest_comparables": [c.movie.title for c in result.comparables[:5]],
            }
            for result in evaluation.concepts
        ],
    }
    return llm.write_concepts_memo(facts, len(loglines))
