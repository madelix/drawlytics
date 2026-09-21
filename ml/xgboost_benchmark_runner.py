from __future__ import annotations

import argparse
import json
import os
import tempfile
from datetime import date, datetime, time
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
        "--draw-date",
        help=(
            "Optional target EuroMillions draw date in YYYY-MM-DD format. "
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
) -> str:
    london_now = datetime.now(LONDON_TIMEZONE)

    include_today = london_now.time() < DRAW_CUTOFF_TIME

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT draw_date
            FROM euromillions_draws
            WHERE draw_date > CURRENT_DATE
               OR (
                    draw_date = CURRENT_DATE
                    AND %s::boolean = true
               )
            ORDER BY draw_date ASC
            LIMIT 1
            """,
            (include_today,),
        )

        row = cursor.fetchone()

    if row is None:
        raise RuntimeError(
            "Could not resolve the next EuroMillions draw date."
        )

    return row[0].isoformat()


def acquire_benchmark_lock(
    connection: psycopg.Connection,
    target_draw_date: str,
) -> None:
    lock_key = f"{LOTTERY}:{MODEL_NAME}:{target_draw_date}"

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
) -> list[dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                draw_date,
                n1,
                n2,
                n3,
                n4,
                n5,
                s1,
                s2
            FROM euromillions_draws
            WHERE draw_date < %s::date
            ORDER BY draw_date ASC
            """,
            (target_draw_date,),
        )

        columns = [
            "draw_date",
            "n1",
            "n2",
            "n3",
            "n4",
            "n5",
            "s1",
            "s2",
        ]

        return [
            dict(zip(columns, row))
            for row in cursor.fetchall()
        ]


def benchmark_prediction_exists(
    connection: psycopg.Connection,
    target_draw_date: str,
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
                LOTTERY,
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
) -> dict[str, Any]:
    main_result = train_and_predict(
        draws=draws,
        keys=["n1", "n2", "n3", "n4", "n5"],
        number_min=1,
        number_max=50,
        pick_count=5,
        pool="main",
        target_draw_date=target_draw_date,
    )

    special_result = train_and_predict(
        draws=draws,
        keys=["s1", "s2"],
        number_min=1,
        number_max=12,
        pick_count=2,
        pool="special",
        target_draw_date=target_draw_date,
    )

    return {
        "main_numbers": main_result["numbers"],
        "special_numbers": special_result["numbers"],
        "main_model": main_result,
        "special_model": special_result,
    }


def insert_benchmark_prediction(
    connection: psycopg.Connection,
    target_draw_date: str,
    prediction: dict[str, Any],
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
                benchmark_eligible
            )
            VALUES (
                %s,
                %s::date,
                %s,
                %s::smallint[],
                %s::smallint[],
                %s,
                NOW(),
                NULL,
                NULL,
                NULL,
                'pending',
                NULL,
                %s,
                true
            )
            RETURNING id
            """,
            (
                LOTTERY,
                target_draw_date,
                MODEL_NAME,
                prediction["main_numbers"],
                prediction["special_numbers"],
                0,
                BENCHMARK_SOURCE,
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
    )

    result = {
        "ok": True,
        "lottery": LOTTERY,
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

    with psycopg.connect(database_url) as connection:
        if args.draw_date:
            target_draw_date = validate_draw_date(
                args.draw_date
            )
        else:
            target_draw_date = resolve_target_draw_date(
                connection
            )

        acquire_benchmark_lock(
            connection,
            target_draw_date,
        )

        if benchmark_prediction_exists(
            connection,
            target_draw_date,
        ):
            connection.rollback()

            print(
                json.dumps(
                    {
                        "ok": True,
                        "lottery": LOTTERY,
                        "model": MODEL_NAME,
                        "draw_date": target_draw_date,
                        "status": "already_exists",
                    },
                    indent=2,
                )
            )
            return

        historical_draws = (
            load_historical_draws_from_database(
                connection,
                target_draw_date,
            )
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
        )

        result = {
            "ok": True,
            "lottery": LOTTERY,
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