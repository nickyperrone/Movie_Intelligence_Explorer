from statistics import median

import pytest

from app import api_models as m
from app.services import concepts, display

LOGLINES = [
    "A teenage girl group of pop stars secretly hunts demons with the power of their songs.",
    "A retired detective in a small coastal town investigates disappearances tied to his past.",
    "An astronaut stranded on Mars must survive alone until a rescue mission arrives.",
]


def concept(
    index: int, rank: int, demand: float | None, p75: float | None = None, eligible: int = 12
) -> m.ConceptResult:
    evidence = m.ExpectedRange(
        status="ok" if demand is not None else "insufficient_evidence",
        p25=demand and demand / 2,
        median=demand,
        p75=p75 if p75 is not None else demand and demand * 1.5,
        benchmark=1000.0,
        eligible_count=eligible,
    )
    return m.ConceptResult(
        index=index,
        logline="x" * 20,
        rank=rank,
        demand_index=demand,
        eligible_count=eligible,
        saturation=0,
        comparables=[],
        demand_by_country=[],
        evidence=evidence,
        demand_vs_typical=demand / 1000 if demand else None,
        evidence_level=concepts.evidence_level(eligible),
        crowded=False,
        comparable_evidence=[],
        reasons=[],
    )


@pytest.mark.parametrize(
    ("results", "status"),
    [
        ([concept(0, 1, 5000, eligible=12), concept(1, 2, 2000, p75=3000)], "clear_lead"),
        # The leader is above the other's upper quartile, but rests on only 4 movies.
        ([concept(0, 1, 5000, eligible=4), concept(1, 2, 2000, p75=3000)], "narrow_lead"),
        # Twice as high, but inside the other's middle half.
        ([concept(0, 1, 4000), concept(1, 2, 2000, p75=6000)], "narrow_lead"),
        ([concept(0, 1, 2200), concept(1, 2, 2000)], "too_close"),
        ([concept(0, 1, 2200), concept(1, 2, None, eligible=1)], "single"),
        (
            [concept(0, 1, None, eligible=2), concept(1, 2, None, eligible=0)],
            "insufficient_evidence",
        ),
    ],
)
def test_decision_rules(results, status):
    decision = concepts.decide(results)
    assert decision.status == status
    assert decision.headline
    assert decision.reasons


def test_evidence_levels():
    assert [concepts.evidence_level(n).root for n in (0, 2, 3, 4, 5, 9, 10)] == [
        "insufficient_evidence",
        "insufficient_evidence",
        "low",
        "low",
        "medium",
        "medium",
        "high",
    ]


@pytest.fixture(scope="module")
def evaluation(client) -> m.ConceptsEvaluation:
    response = client.post("/api/v1/decisions/concepts", json={"loglines": LOGLINES})
    assert response.status_code == 200
    return m.ConceptsEvaluation.model_validate(response.json())


def test_every_concept_is_ranked_once(evaluation):
    assert sorted(c.rank for c in evaluation.concepts) == [1, 2, 3]
    by_rank = sorted(evaluation.concepts, key=lambda c: c.rank)
    indexes = [c.demand_index for c in by_rank if c.demand_index is not None]
    assert indexes == sorted(indexes, reverse=True)


def test_demand_index_is_the_median_of_the_movies_shown(evaluation):
    for result in evaluation.concepts:
        values = [c.first_six_month_streams for c in result.comparable_evidence if c.eligible]
        assert result.eligible_count == len(values)
        if len(values) < 3:
            assert result.demand_index is None
        else:
            assert result.demand_index == pytest.approx(median(values))
        assert [c.movie.title_id for c in result.comparable_evidence] == [
            c.movie.title_id for c in result.comparables
        ]


def test_reasons_quote_the_computed_figures(evaluation):
    for result in evaluation.concepts:
        text = " ".join(result.reasons)
        assert str(len(result.comparables)) in text
        if result.demand_index is not None:
            assert display.compact(result.demand_index) in text
    top = min(evaluation.concepts, key=lambda c: c.rank)
    assert f"Concept {top.index + 1}" in evaluation.decision.headline


def test_the_method_values_are_returned(evaluation):
    assert evaluation.typical_movie and evaluation.typical_movie > 0
    assert evaluation.window_start_limit.root == "2026-01"
    assert evaluation.similarity_cutoff > 0
