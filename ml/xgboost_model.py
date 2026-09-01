from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


FREQUENCY_WINDOWS = (5, 10, 20, 50)


LOTTERY_CONFIGS = {
    "euromillions": {
        "main_min": 1,
        "main_max": 50,
        "main_count": 5,
        "special_min": 1,
        "special_max": 12,
        "special_count": 2,
        "main_keys": ["n1", "n2", "n3", "n4", "n5"],
        "special_keys": ["s1", "s2"],
    },
    "uk_lotto": {
        "main_min": 1,
        "main_max": 59,
        "main_count": 6,
        "special_min": 1,
        "special_max": 59,
        "special_count": 1,
        "main_keys": ["n1", "n2", "n3", "n4", "n5", "n6"],
        "special_keys": ["bonus_ball"],
    },
    "set_for_life": {
        "main_min": 1,
        "main_max": 47,
        "main_count": 5,
        "special_min": 1,
        "special_max": 10,
        "special_count": 1,
        "main_keys": ["n1", "n2", "n3", "n4", "n5"],
        "special_keys": ["life_ball"],
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train and run the Drawlytics XGBoost model."
    )

    parser.add_argument(
        "--lottery",
        required=True,
        choices=sorted(LOTTERY_CONFIGS.keys()),
    )

    parser.add_argument(
        "--draw-date",
        required=True,
        help="Target draw date in YYYY-MM-DD format.",
    )

    parser.add_argument(
        "--input",
        help=(
            "Path to a JSON file containing historical "
            "draws ordered oldest to newest."
        ),
    )

    return parser.parse_args()


def get_draw_numbers(
    draw: dict[str, Any],
    keys: list[str],
) -> set[int]:
    numbers: set[int] = set()

    for key in keys:
        value = draw.get(key)

        if value is None:
            continue

        try:
            numbers.add(int(value))
        except (TypeError, ValueError):
            continue

    return numbers


def frequency(
    history: list[set[int]],
    number: int,
    window: int | None = None,
) -> float:
    relevant = history if window is None else history[-window:]

    if not relevant:
        return 0.0

    hits = sum(
        1
        for draw_numbers in relevant
        if number in draw_numbers
    )

    return hits / len(relevant)


def gap_since_last_seen(
    history: list[set[int]],
    number: int,
) -> int:
    for gap, draw_numbers in enumerate(
        reversed(history),
        start=1,
    ):
        if number in draw_numbers:
            return gap

    return len(history) + 1


def average_gap(
    history: list[set[int]],
    number: int,
) -> float:
    appearances = [
        index
        for index, draw_numbers in enumerate(history)
        if number in draw_numbers
    ]

    if len(appearances) < 2:
        return float(len(history) + 1)

    gaps = np.diff(appearances)

    return float(np.mean(gaps))


def recency_weighted_frequency(
    history: list[set[int]],
    number: int,
) -> float:
    if not history:
        return 0.0

    weights = np.arange(
        1,
        len(history) + 1,
        dtype=float,
    )

    hits = np.array(
        [
            1.0 if number in draw_numbers else 0.0
            for draw_numbers in history
        ]
    )

    return float(
        np.dot(hits, weights) / weights.sum()
    )


def build_number_features(
    history: list[set[int]],
    number: int,
    number_min: int,
    number_max: int,
) -> dict[str, float]:
    range_size = max(
        1,
        number_max - number_min,
    )

    features: dict[str, float] = {
        "number": float(number),
        "number_normalized": (
            number - number_min
        ) / range_size,
        "frequency_all": frequency(
            history,
            number,
        ),
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
        "recency_weighted_frequency":
            recency_weighted_frequency(
                history,
                number,
            ),
    }

    for window in FREQUENCY_WINDOWS:
        features[
            f"frequency_{window}"
        ] = frequency(
            history,
            number,
            window,
        )

    features["momentum_5_vs_20"] = (
        features["frequency_5"]
        - features["frequency_20"]
    )

    features["momentum_10_vs_50"] = (
        features["frequency_10"]
        - features["frequency_50"]
    )

    return features


def build_training_rows(
    draws: list[dict[str, Any]],
    keys: list[str],
    number_min: int,
    number_max: int,
    minimum_history: int = 20,
) -> pd.DataFrame:
    draw_sets = [
        get_draw_numbers(draw, keys)
        for draw in draws
    ]

    rows: list[dict[str, float | int]] = []

    for target_index in range(
        minimum_history,
        len(draw_sets),
    ):
        history = draw_sets[:target_index]
        target = draw_sets[target_index]

        for number in range(
            number_min,
            number_max + 1,
        ):
            features = build_number_features(
                history,
                number,
                number_min,
                number_max,
            )

            rows.append(
                {
                    **features,
                    "target": (
                        1
                        if number in target
                        else 0
                    ),
                }
            )

    return pd.DataFrame(rows)


def main() -> None:
    args = parse_args()

    config = LOTTERY_CONFIGS[args.lottery]

    draws: list[dict[str, Any]] = []

    if args.input:
        input_path = Path(args.input)

        with input_path.open(
            "r",
            encoding="utf-8",
        ) as file:
            draws = json.load(file)

        if not isinstance(draws, list):
            raise ValueError(
                "Historical draw input must be a JSON array."
            )

    result = {
        "ok": True,
        "model": "xgboost",
        "lottery": args.lottery,
        "draw_date": args.draw_date,
        "historical_draws": len(draws),
        "main_range": [
            config["main_min"],
            config["main_max"],
        ],
        "special_range": [
            config["special_min"],
            config["special_max"],
        ],
        "features": [
            "number_normalized",
            "frequency_all",
            "frequency_5",
            "frequency_10",
            "frequency_20",
            "frequency_50",
            "gap_since_last_seen",
            "average_gap",
            "recency_weighted_frequency",
            "momentum_5_vs_20",
            "momentum_10_vs_50",
        ],
        "status": "feature_builder_ready",
    }

    print(json.dumps(result))


if __name__ == "__main__":
    main()
