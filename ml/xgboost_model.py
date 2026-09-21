from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from xgboost import XGBClassifier
import sys


FEATURE_COLUMNS = [
    "number_normalized",
    "frequency_all",
    "frequency_5",
    "frequency_10",
    "frequency_20",
    "gap_since_last_seen",
    "average_gap",
    "momentum_5_vs_20",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--lottery",
        required=True,
        choices=["euromillions"],
    )
    parser.add_argument("--draw-date", required=True)
    parser.add_argument("--input", required=True)
    parser.add_argument(
    "--validate",
    action="store_true",
    help="Run full chronological walk-forward validation.",
)
    return parser.parse_args()


def load_draws(
    path: str,
    target_draw_date: str,
) -> list[dict[str, Any]]:
    with Path(path).open(
        "r",
        encoding="utf-8",
    ) as file:
        payload = json.load(file)

    if isinstance(payload, list):
        draws = payload
    elif (
        isinstance(payload, dict)
        and isinstance(payload.get("draws"), list)
    ):
        draws = payload["draws"]
    else:
        raise ValueError(
            "Input must be a JSON array or "
            "an object containing a 'draws' array."
        )

    target = pd.Timestamp(target_draw_date, tz="UTC")

    for draw in draws:
        draw_date = pd.Timestamp(draw["draw_date"])

    if draw_date.tzinfo is None:
      draw_date = draw_date.tz_localize("UTC")
    else:
     draw_date = draw_date.tz_convert("UTC")

    if draw_date >= target:
            raise ValueError(
                "Look-ahead protection triggered by "
                f"draw {draw['draw_date']}."
            )

    draws.sort(
        key=lambda draw: draw["draw_date"]
    )

    return draws


def get_numbers(
    draw: dict[str, Any],
    keys: list[str],
) -> set[int]:
    return {
        int(draw[key])
        for key in keys
        if draw.get(key) is not None
    }


def lucky_star_max(
    draw_date: str,
) -> int:
    date = pd.Timestamp(draw_date)

    if date.tzinfo is None:
        date = date.tz_localize("UTC")
    else:
        date = date.tz_convert("UTC")

    if date < pd.Timestamp(
        "2011-05-10",
        tz="UTC",
    ):
        return 9

    if date < pd.Timestamp(
        "2016-09-27",
        tz="UTC",
    ):
        return 11

    return 12


def frequency(
    history: list[set[int]],
    number: int,
    window: int | None = None,
) -> float:
    relevant = (
        history
        if window is None
        else history[-window:]
    )

    if not relevant:
        return 0.0

    return (
        sum(
            number in draw
            for draw in relevant
        )
        / len(relevant)
    )


def gap_since_last_seen(
    history: list[set[int]],
    number: int,
) -> int:
    for gap, draw in enumerate(
        reversed(history),
        start=1,
    ):
        if number in draw:
            return gap

    return len(history) + 1


def average_gap(
    history: list[set[int]],
    number: int,
) -> float:
    seen_at = [
        index
        for index, draw in enumerate(history)
        if number in draw
    ]

    if len(seen_at) < 2:
        return float(
            len(history) + 1
        )

    return float(
        np.mean(
            np.diff(seen_at)
        )
    )


def build_features(
    history: list[set[int]],
    number: int,
    number_min: int,
    number_max: int,
) -> dict[str, float]:
    denominator = max(
        1,
        number_max - number_min,
    )

    frequency_5 = frequency(
        history,
        number,
        5,
    )

    frequency_10 = frequency(
        history,
        number,
        10,
    )

    frequency_20 = frequency(
        history,
        number,
        20,
    )

    return {
        "number_normalized": (
            number - number_min
        ) / denominator,
        "frequency_all": frequency(
            history,
            number,
        ),
        "frequency_5": frequency_5,
        "frequency_10": frequency_10,
        "frequency_20": frequency_20,
        "gap_since_last_seen": float(
            gap_since_last_seen(
                history,
                number,
            )
        ),
        "average_gap": average_gap(
            history,
            number,
        ),
        "momentum_5_vs_20": (
            frequency_5
            - frequency_20
        ),
    }


def build_training_frame(
    draws: list[dict[str, Any]],
    keys: list[str],
    number_min: int,
    number_max: int,
    pool: str,
    minimum_history: int = 20,
) -> pd.DataFrame:
    draw_sets = [
        get_numbers(
            draw,
            keys,
        )
        for draw in draws
    ]

    rows: list[
        dict[str, float | int]
    ] = []

    for target_index in range(
        minimum_history,
        len(draws),
    ):
        history = draw_sets[:target_index]
        actual = draw_sets[target_index]

        candidate_max = number_max

        if pool == "special":
            candidate_max = lucky_star_max(
                draws[target_index][
                    "draw_date"
                ]
            )

        for number in range(
            number_min,
            candidate_max + 1,
        ):
            rows.append(
                {
                    **build_features(
                        history,
                        number,
                        number_min,
                        candidate_max,
                    ),
                    "target": (
                        1
                        if number in actual
                        else 0
                    ),
                }
            )

    return pd.DataFrame(rows)


def train_and_predict(
    draws: list[dict[str, Any]],
    keys: list[str],
    number_min: int,
    number_max: int,
    pick_count: int,
    pool: str,
    target_draw_date: str,
) -> dict[str, Any]:
    training = build_training_frame(
        draws=draws,
        keys=keys,
        number_min=number_min,
        number_max=number_max,
        pool=pool,
    )

    if training.empty:
        raise ValueError(
            "Not enough historical draws "
            "to train."
        )

    x_train = training[
        FEATURE_COLUMNS
    ]

    y_train = training[
        "target"
    ].astype(int)

    positives = int(
        y_train.sum()
    )

    negatives = int(
        len(y_train) - positives
    )

    if positives == 0:
        raise ValueError(
            "Training data contains "
            "no positive examples."
        )

    model = XGBClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="binary:logistic",
        eval_metric="logloss",
        scale_pos_weight=(
            negatives / positives
        ),
        random_state=42,
        n_jobs=-1,
    )

    model.fit(
        x_train,
        y_train,
    )

    history = [
        get_numbers(
            draw,
            keys,
        )
        for draw in draws
    ]

    candidate_max = number_max

    if pool == "special":
        candidate_max = lucky_star_max(
            target_draw_date
        )

    candidate_rows = []

    for number in range(
        number_min,
        candidate_max + 1,
    ):
        candidate_rows.append(
            (
                number,
                build_features(
                    history,
                    number,
                    number_min,
                    candidate_max,
                ),
            )
        )

    x_predict = pd.DataFrame(
        [
            features
            for _, features
            in candidate_rows
        ]
    )[FEATURE_COLUMNS]

    probabilities = (
        model.predict_proba(
            x_predict
        )[:, 1]
    )

    ranked = sorted(
        [
            {
                "number": number,
                "score": float(
                    probability
                ),
            }
            for (
                number,
                _
            ), probability in zip(
                candidate_rows,
                probabilities,
            )
        ],
        key=lambda item: item["score"],
        reverse=True,
    )

    selected = ranked[
        :pick_count
    ]

    return {
        "numbers": sorted(
            item["number"]
            for item in selected
        ),
        "scores": selected,
        "training_rows": len(
            training
        ),
        "positive_examples": positives,
        "negative_examples": negatives,
    }

def walk_forward_evaluate(
    draws: list[dict[str, Any]],
    evaluation_draws: int = 10,
) -> dict[str, Any]:
    if len(draws) < evaluation_draws + 20:
        raise ValueError(
            "Not enough historical draws "
            "for walk-forward evaluation."
        )

    start_index = max(
        21,
        len(draws) - evaluation_draws,
    )

    evaluation_draws = (
        len(draws) - start_index
    )

    results = []
    total_main_hits = 0
    total_special_hits = 0
    total_hot_star_hits = 0

    for target_index in range(
        start_index,
        len(draws),
    ):
        print(
            f"Evaluating draw "
            f"{target_index - start_index + 1}"
            f"/{evaluation_draws}...",
            file=sys.stderr,
            flush=True,
        )

        history = draws[:target_index]
        actual_draw = draws[target_index]
        target_date = actual_draw["draw_date"]

        star_pool = lucky_star_max(target_date)

        star_counts = {
            number: 0
            for number in range(
                1,
                star_pool + 1,
            )
        }

        for historical_draw in history:
            historical_stars = get_numbers(
                historical_draw,
                [
                    "s1",
                    "s2",
                ],
            )

            for star in historical_stars:
                if star <= star_pool:
                    star_counts[star] += 1

        hot_star_prediction = set(
            sorted(
                star_counts,
                key=lambda number: (
                    -star_counts[number],
                    number,
                ),
            )[:2]
        )

        main_result = train_and_predict(
            draws=history,
            keys=[
                "n1",
                "n2",
                "n3",
                "n4",
                "n5",
            ],
            number_min=1,
            number_max=50,
            pick_count=5,
            pool="main",
            target_draw_date=target_date,
        )

        special_result = train_and_predict(
            draws=history,
            keys=[
                "s1",
                "s2",
            ],
            number_min=1,
            number_max=12,
            pick_count=2,
            pool="special",
            target_draw_date=target_date,
        )

        actual_main = get_numbers(
            actual_draw,
            [
                "n1",
                "n2",
                "n3",
                "n4",
                "n5",
            ],
        )

        actual_special = get_numbers(
            actual_draw,
            [
                "s1",
                "s2",
            ],
        )

        predicted_main = set(
            main_result["numbers"]
        )

        predicted_special = set(
            special_result["numbers"]
        )

        main_hits = len(
            predicted_main & actual_main
        )

        special_hits = len(
            predicted_special & actual_special
        )
        hot_star_hits = len(
    hot_star_prediction & actual_special
)

        total_hot_star_hits += (
    hot_star_hits
)

        total_main_hits += main_hits
        total_special_hits += special_hits

        results.append(
            {
                "draw_date": target_date,
                "predicted_main": sorted(
                    predicted_main
                ),
                "actual_main": sorted(
                    actual_main
                ),
                "main_hits": main_hits,
                "predicted_special": sorted(
                    predicted_special
                ),
                "actual_special": sorted(
                    actual_special
                ),
                "special_hits": special_hits,

                "hot_star_prediction": sorted(
                 hot_star_prediction
            ),
                "hot_star_hits": hot_star_hits,
            }
        )

    average_main_hits = (
        total_main_hits / evaluation_draws
    )

    average_special_hits = (
        total_special_hits / evaluation_draws
    )

    average_hot_star_hits = (
    total_hot_star_hits / evaluation_draws
    )

    random_expected_main_hits = (
        5 * 5 / 50
    )

    random_expected_special_hits = (
        sum(
            2 * 2 / lucky_star_max(
                draw["draw_date"]
            )
            for draw in draws[start_index:]
        )
        / evaluation_draws
    )

    era_totals = {
        "2004_2011": {
            "draws": 0,
            "special_hits": 0,
            "random_expected_special_hits": 0.0,
        },
        "2011_2016": {
            "draws": 0,
            "special_hits": 0,
            "random_expected_special_hits": 0.0,
        },
        "2016_present": {
            "draws": 0,
            "special_hits": 0,
            "random_expected_special_hits": 0.0,
        },
    }

    for draw_result in results:
        draw_date = pd.Timestamp(
            draw_result["draw_date"]
        )

        if draw_date.tzinfo is None:
            draw_date = draw_date.tz_localize(
                "UTC"
            )
        else:
            draw_date = draw_date.tz_convert(
                "UTC"
            )

        if draw_date < pd.Timestamp(
            "2011-05-10",
            tz="UTC",
        ):
            era_key = "2004_2011"

        elif draw_date < pd.Timestamp(
            "2016-09-27",
            tz="UTC",
        ):
            era_key = "2011_2016"

        else:
            era_key = "2016_present"

        star_pool = lucky_star_max(
            draw_result["draw_date"]
        )

        era_totals[
            era_key
        ]["draws"] += 1

        era_totals[
            era_key
        ]["special_hits"] += (
            draw_result["special_hits"]
        )

        era_totals[
            era_key
        ][
            "random_expected_special_hits"
        ] += (
            4 / star_pool
        )

    for era in era_totals.values():
        expected = era[
            "random_expected_special_hits"
        ]

        if expected > 0:
            era[
                "special_vs_random_ratio"
            ] = (
                era["special_hits"]
                / expected
            )
        else:
            era[
                "special_vs_random_ratio"
            ] = None

    return {
        "evaluation_draws": evaluation_draws,
        "total_main_hits": total_main_hits,
        "average_main_hits": (
            average_main_hits
        ),
        "random_expected_main_hits": (
            random_expected_main_hits
        ),
        "main_vs_random_ratio": (
            average_main_hits
            / random_expected_main_hits
        ),
        "total_special_hits": (
            total_special_hits
        ),
        "average_special_hits": (
            average_special_hits
        ),
        "random_expected_special_hits": (
            random_expected_special_hits
        ),
        "special_vs_random_ratio": (
            average_special_hits
            / random_expected_special_hits
        ),
        "total_hot_star_hits": (
    total_hot_star_hits
),
"average_hot_star_hits": (
    average_hot_star_hits
),
"hot_star_vs_random_ratio": (
    average_hot_star_hits
    / random_expected_special_hits
),
"xgboost_vs_hot_star_ratio": (
    average_special_hits
    / average_hot_star_hits
    if average_hot_star_hits > 0
    else None
),
        "draws": results,
        "special_era_breakdown": (
            era_totals
        ),
    }

def main() -> None:
    args = parse_args()

    draws = load_draws(
        args.input,
        args.draw_date,
    )

    main_result = train_and_predict(
        draws=draws,
        keys=[
            "n1",
            "n2",
            "n3",
            "n4",
            "n5",
        ],
        number_min=1,
        number_max=50,
        pick_count=5,
        pool="main",
        target_draw_date=args.draw_date,
    )

    special_result = train_and_predict(
        draws=draws,
        keys=[
            "s1",
            "s2",
        ],
        number_min=1,
        number_max=12,
        pick_count=2,
        pool="special",
        target_draw_date=args.draw_date,
    )

    evaluation = None

    if args.validate:
        evaluation = walk_forward_evaluate(
         draws=draws,
         evaluation_draws=len(draws) - 20,
    )

    result = {
        "ok": True,
        "model": "xgboost_v2",
        "lottery": args.lottery,
        "draw_date": args.draw_date,
        "historical_draws": len(draws),
        "main_numbers": (
            main_result["numbers"]
        ),
        "special_numbers": (
            special_result["numbers"]
        ),
        "main_model": main_result,
        "special_model": special_result,
        "status": "trained_and_predicted",
        "walk_forward": evaluation,
    }

    print(
        json.dumps(
            result,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()