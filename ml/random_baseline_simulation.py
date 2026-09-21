import argparse
import json
import random
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


SIMULATIONS = 100_000
RANDOM_SEED = 42


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


def load_evaluation(
    path: Path,
) -> list[dict[str, Any]]:
    with path.open(
        "r",
        encoding="utf-8",
    ) as file:
        data = json.load(file)

    walk_forward = data.get(
        "walk_forward"
    )

    if not walk_forward:
        raise ValueError(
            "File does not contain "
            "walk_forward results."
        )

    draws = walk_forward.get("draws")

    if not draws:
        raise ValueError(
            "Walk-forward results "
            "contain no draws."
        )

    return draws


def simulate_random_baseline(
    draws: list[dict[str, Any]],
    observed_hits: int,
    simulations: int,
) -> dict[str, Any]:
    random.seed(RANDOM_SEED)

    simulated_totals = []

    for simulation_index in range(
        simulations
    ):
        total_hits = 0

        for draw in draws:
            star_pool = lucky_star_max(
                draw["draw_date"]
            )

            predicted = set(
                random.sample(
                    range(
                        1,
                        star_pool + 1,
                    ),
                    2,
                )
            )

            actual = set(
                draw["actual_special"]
            )

            total_hits += len(
                predicted & actual
            )

        simulated_totals.append(
            total_hits
        )

        if (
            simulation_index + 1
        ) % 10_000 == 0:
            print(
                f"Completed "
                f"{simulation_index + 1:,}"
                f"/{simulations:,} simulations..."
            )

    totals = np.array(
        simulated_totals
    )

    equal_or_better = int(
        np.sum(
            totals >= observed_hits
        )
    )

    empirical_p_value = (
        equal_or_better + 1
    ) / (
        simulations + 1
    )

    return {
        "simulations": simulations,
        "observed_xgboost_hits": (
            observed_hits
        ),
        "random_mean_hits": float(
            totals.mean()
        ),
        "random_std_hits": float(
            totals.std(ddof=1)
        ),
        "random_median_hits": float(
            np.median(totals)
        ),
        "random_95th_percentile": float(
            np.percentile(
                totals,
                95,
            )
        ),
        "random_99th_percentile": float(
            np.percentile(
                totals,
                99,
            )
        ),
        "random_max_hits": int(
            totals.max()
        ),
        "simulations_equal_or_better": (
            equal_or_better
        ),
        "empirical_p_value": float(
            empirical_p_value
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--input",
        required=True,
    )

    parser.add_argument(
        "--simulations",
        type=int,
        default=SIMULATIONS,
    )

    args = parser.parse_args()

    input_path = Path(args.input)

    draws = load_evaluation(
        input_path
    )

    observed_hits = sum(
        int(draw["special_hits"])
        for draw in draws
    )

    result = simulate_random_baseline(
        draws=draws,
        observed_hits=observed_hits,
        simulations=args.simulations,
    )

    print(
        json.dumps(
            result,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()