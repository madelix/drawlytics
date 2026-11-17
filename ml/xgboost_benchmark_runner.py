from __future__ import annotations

import argparse
import json
import os
import tempfile
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import psycopg

from xgboost_model import load_draws, train_and_predict


MODEL_NAME = "xgboost_v2"
BENCHMARK_SOURCE = "benchmark_ml_runner"
LOTTERY = "euromillions"

LONDON_TIMEZONE = ZoneInfo("Europe/London")
DRAW_CUTOFF_TIME = time(19, 20)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--lottery",
        choices=("euromillions", "uk_lotto", "set_for_life"),
        default=LOTTERY,
        help="Lottery to train and predict for. Defaults to EuroMillions.",
    )

    parser.add_argument(
        "--draw-date",
        help=(
            "Optional target draw date in YYYY-MM-DD format. "
            "Database mode resolves the next draw automatically when omitted."
        ),
    )

    parser.add_argument(
        "--input",
        help=(
            "Optional historical draw JSON file. "
            "When supplied, the runner does not connect to PostgreSQL."
        ),
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Generate the prediction without saving it.",
    )

    parser.add_argument(
        "--prospective",
        action="store_true",
        help="Allow prospective classification for an automatically selected draw.",
    )

    return parser.parse_args()


def get_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise RuntimeError(
            "DATABASE_URL environment variable is required."
        )

    return database_url


def validate_draw_date(draw_date: str) -> str:
    try:
        parsed = date.fromisoformat(draw_date)
    except ValueError as error:
        raise RuntimeError(
            "Draw date must use YYYY-MM-DD format."
        ) from error

    return parsed.isoformat()


def resolve_target_draw_date(
    connection: psycopg.Connection,
    lottery: str = LOTTERY,
) -> str:
    """Resolve the next scheduled draw using the London cutoff."""
    del connection

    draw_weekdays = {
        "euromillions": {1, 4},
        "uk_lotto": {2, 5},
        "set_for_life": {0, 3},
    }[lottery]

    london_now = datetime.now(LONDON_TIMEZONE)
    candidate = london_now.date()

    if (
        candidate.weekday() in draw_weekdays
        and london_now.time() < DRAW_CUTOFF_TIME
    ):
        return candidate.isoformat()

    candidate += timedelta(days=1)

    while candidate.weekday() not in draw_weekdays:
        candidate += timedelta(days=1)

    return candidate.isoformat()




def acquire_benchmark_lock(
    connection: psycopg.Connection,
    target_draw_date: str,
    lottery: str = LOTTERY,
) -> None:
    lock_key = f"{lottery}:{MODEL_NAME}:{target_draw_date}"

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT pg_advisory_xact_lock(
                hashtextextended(%s, 0)
            )
            """,
            (lock_key,),
        )


def load_historical_draws_from_database(
    connection: psycopg.Connection,
    target_draw_date: str,
    lottery: str = LOTTERY,
) -> list[dict[str, Any]]:
    table, number_columns, sort_columns = {
        "euromillions": (
            "euromillions_draws",
            ("n1", "n2", "n3", "n4", "n5", "s1", "s2"),
            "draw_date ASC",
        ),
        "uk_lotto": (
            "uk_lotto_draws",
            ("n1", "n2", "n3", "n4", "n5", "n6", "bonus_ball"),
            "draw_date ASC, draw_sequence ASC",
        ),
        "set_for_life": (
            "set_for_life_draws",
            ("n1", "n2", "n3", "n4", "n5", "life_ball"),
            "draw_date ASC",
        ),
    }[lottery]

    columns = ("draw_date", *number_columns)

    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT {", ".join(columns)}
            FROM {table}
            WHERE draw_date < %s::date
            ORDER BY {sort_columns}
            """,
            (target_draw_date,),
        )

        return [dict(zip(columns, row)) for row in cursor.fetchall()]




def benchmark_prediction_exists(
    connection: psycopg.Connection,
    target_draw_date: str,
    lottery: str = LOTTERY,
) -> bool:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT 1
            FROM predictions
            WHERE LOWER(lottery) = LOWER(%s)
              AND draw_date = %s::date
              AND model_name = %s
              AND source = %s
              AND benchmark_eligible = true
            LIMIT 1
            """,
            (
                lottery,
                target_draw_date,
                MODEL_NAME,
                BENCHMARK_SOURCE,
            ),
        )

        return cursor.fetchone() is not None


def prepare_database_draws_for_model(
    draws: list[dict[str, Any]],
    target_draw_date: str,
) -> list[dict[str, Any]]:
    serializable_draws = []

    for draw in draws:
        serializable_draws.append(
            {
                **draw,
                "draw_date": (
                    draw["draw_date"].isoformat()
                    if isinstance(draw["draw_date"], date)
                    else str(draw["draw_date"])
                ),
            }
        )

    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".json",
        encoding="utf-8",
        delete=False,
    ) as temp_file:
        json.dump(serializable_draws, temp_file)
        temp_path = temp_file.name

    try:
        return load_draws(
            temp_path,
            target_draw_date,
        )
    finally:
        Path(temp_path).unlink(missing_ok=True)


def generate_prediction(
    draws: list[dict[str, Any]],
    target_draw_date: str,
    lottery: str = LOTTERY,
) -> dict[str, Any]:
    main_count, main_max = {
        "euromillions": (5, 50),
        "uk_lotto": (6, 59),
        "set_for_life": (5, 47),
    }[lottery]

    main_result = train_and_predict(
        draws=draws,
        keys=[f"n{index}" for index in range(1, main_count + 1)],
        number_min=1,
        number_max=main_max,
        pick_count=main_count,
        pool="main",
        target_draw_date=target_draw_date,
    )

    special_result = None

    if lottery == "euromillions":
        special_result = train_and_predict(
            draws=draws,
            keys=["s1", "s2"],
            number_min=1,
            number_max=12,
            pick_count=2,
            pool="special",
            target_draw_date=target_draw_date,
        )
    elif lottery == "set_for_life":
        special_result = train_and_predict(
            draws=draws,
            keys=["life_ball"],
            number_min=1,
            number_max=10,
            pick_count=1,
            pool="life_ball",
            target_draw_date=target_draw_date,
        )

    return {
        "main_numbers": main_result["numbers"],
        "special_numbers": special_result["numbers"] if special_result else [],
        "main_model": main_result,
        "special_model": special_result,
    }




def insert_benchmark_prediction(
    connection: psycopg.Connection,
    target_draw_date: str,
    prediction: dict[str, Any],
    lottery: str = LOTTERY,
    classify_prospective: bool = False,
) -> int:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO predictions (
                lottery,
                draw_date,
                model_name,
                main_numbers,
                star_numbers,
                confidence,
                created_at,
                matched_main,
                matched_stars,
                result_label,
                status,
                user_id,
                source,
                benchmark_eligible,
                benchmark_evidence_class
            )
            VALUES (
                %s,
                %s::date,
                %s,
                %s::smallint[],
                %s::smallint[],
                %s,
                statement_timestamp(),
                NULL,
                NULL,
                NULL,
                'pending',
                NULL,
                %s,
                true,
                CASE
                    WHEN %s::boolean
                        AND (statement_timestamp() AT TIME ZONE 'Europe/London')
                            < (%s::date + %s::time)
                    THEN 'prospective'
                    ELSE 'unverified'
                END
            )
            RETURNING id
            """,
            (
                lottery,
                target_draw_date,
                MODEL_NAME,
                prediction["main_numbers"],
                prediction["special_numbers"],
                0,
                BENCHMARK_SOURCE,
                classify_prospective,
                target_draw_date,
                DRAW_CUTOFF_TIME,
            ),
        )

        row = cursor.fetchone()

        if row is None:
            raise RuntimeError(
                "Prediction insert did not return an ID."
            )

        return int(row[0])


def run_file_mode(args: argparse.Namespace) -> None:
    if not args.draw_date:
        raise RuntimeError(
            "--draw-date is required when using --input."
        )

    target_draw_date = validate_draw_date(args.draw_date)

    draws = load_draws(
        args.input,
        target_draw_date,
    )

    if len(draws) < 21:
        raise RuntimeError(
            "At least 21 historical draws are required "
            "to train XGBoost v2."
        )

    prediction = generate_prediction(
        draws,
        target_draw_date,
        lottery=args.lottery,
    )

    result = {
        "ok": True,
        "lottery": args.lottery,
        "model": MODEL_NAME,
        "draw_date": target_draw_date,
        "historical_draws": len(draws),
        "main_numbers": prediction["main_numbers"],
        "special_numbers": prediction["special_numbers"],
        "source": BENCHMARK_SOURCE,
        "benchmark_eligible": True,
        "status": "file_dry_run",
        "prediction_id": None,
    }

    print(json.dumps(result, indent=2))


def run_database_mode(args: argparse.Namespace) -> None:
    database_url = get_database_url()
    lottery = args.lottery

    with psycopg.connect(database_url) as connection:
        if args.draw_date:
            target_draw_date = validate_draw_date(args.draw_date)
        else:
            target_draw_date = resolve_target_draw_date(
                connection,
                lottery=lottery,
            )

        acquire_benchmark_lock(connection, target_draw_date, lottery=lottery)

        if benchmark_prediction_exists(
            connection,
            target_draw_date,
            lottery=lottery,
        ):
            connection.rollback()

            print(
                json.dumps(
                    {
                        "ok": True,
                        "lottery": lottery,
                        "model": MODEL_NAME,
                        "draw_date": target_draw_date,
                        "status": "already_exists",
                    },
                    indent=2,
                )
            )
            return

        historical_draws = load_historical_draws_from_database(
            connection,
            target_draw_date,
            lottery=lottery,
        )

        if len(historical_draws) < 21:
            raise RuntimeError(
                "At least 21 historical draws are required "
                "to train XGBoost v2."
            )

        model_draws = prepare_database_draws_for_model(
            historical_draws,
            target_draw_date,
        )

        prediction = generate_prediction(
            model_draws,
            target_draw_date,
            lottery=lottery,
        )

        result = {
            "ok": True,
            "lottery": lottery,
            "model": MODEL_NAME,
            "draw_date": target_draw_date,
            "historical_draws": len(model_draws),
            "main_numbers": prediction["main_numbers"],
            "special_numbers": prediction["special_numbers"],
            "source": BENCHMARK_SOURCE,
            "benchmark_eligible": True,
        }

        if args.dry_run:
            connection.rollback()
            result["status"] = "dry_run"
            result["prediction_id"] = None
        else:
            prediction_id = insert_benchmark_prediction(
                connection,
                target_draw_date,
                prediction,
                lottery=lottery,
                classify_prospective=args.prospective and args.draw_date is None,
            )

            connection.commit()
            result["status"] = "saved"
            result["prediction_id"] = prediction_id

        print(json.dumps(result, indent=2))


def main() -> None:
    args = parse_args()

    if args.input:
        run_file_mode(args)
        return

    run_database_mode(args)


if __name__ == "__main__":
    main()