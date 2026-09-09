"""Daily usage counters and spend ceilings.

A cheap insurance policy for a pro-bono deployment: even if rate limiting is
somehow bypassed, the whole site stops calling the model once the day's request
or token budget is spent, and shows a friendly "resting" message instead.
"""
from __future__ import annotations

import datetime as _dt
import sqlite3

import config


def _today() -> str:
    return _dt.date.today().isoformat()


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(config.DB_PATH)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS usage_daily (
            day TEXT PRIMARY KEY,
            requests INTEGER NOT NULL DEFAULT 0,
            input_tokens INTEGER NOT NULL DEFAULT 0,
            output_tokens INTEGER NOT NULL DEFAULT 0
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS usage_by_user (
            day TEXT NOT NULL,
            identity TEXT NOT NULL,
            requests INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (day, identity)
        )"""
    )
    # "Bring it to life" image generation is counted separately from chat, because
    # each call costs ~100x a chat turn and needs its own, much tighter ceiling.
    conn.execute(
        """CREATE TABLE IF NOT EXISTS illustrate_daily (
            day TEXT PRIMARY KEY,
            requests INTEGER NOT NULL DEFAULT 0
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS illustrate_by_user (
            day TEXT NOT NULL,
            identity TEXT NOT NULL,
            requests INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (day, identity)
        )"""
    )
    return conn


class BudgetExceeded(Exception):
    def __init__(self, scope: str):
        super().__init__(scope)
        self.scope = scope


def check(identity: str | None) -> None:
    """Raise BudgetExceeded if today's caps are already spent."""
    day = _today()
    conn = _conn()
    try:
        row = conn.execute(
            "SELECT requests, input_tokens, output_tokens FROM usage_daily WHERE day = ?",
            (day,),
        ).fetchone()
        requests, in_tok, out_tok = row or (0, 0, 0)
        if requests >= config.DAILY_REQUEST_CAP:
            raise BudgetExceeded("daily-requests")
        if in_tok + out_tok >= config.DAILY_TOKEN_CAP:
            raise BudgetExceeded("daily-tokens")
        if identity:
            urow = conn.execute(
                "SELECT requests FROM usage_by_user WHERE day = ? AND identity = ?",
                (day, identity),
            ).fetchone()
            if urow and urow[0] >= config.DAILY_REQUEST_CAP_PER_USER:
                raise BudgetExceeded("user-requests")
    finally:
        conn.close()


def record(identity: str | None, input_tokens: int = 0, output_tokens: int = 0) -> None:
    day = _today()
    conn = _conn()
    try:
        conn.execute(
            """INSERT INTO usage_daily (day, requests, input_tokens, output_tokens)
               VALUES (?, 1, ?, ?)
               ON CONFLICT(day) DO UPDATE SET
                 requests = requests + 1,
                 input_tokens = input_tokens + excluded.input_tokens,
                 output_tokens = output_tokens + excluded.output_tokens""",
            (day, input_tokens, output_tokens),
        )
        if identity:
            conn.execute(
                """INSERT INTO usage_by_user (day, identity, requests) VALUES (?, ?, 1)
                   ON CONFLICT(day, identity) DO UPDATE SET requests = requests + 1""",
                (day, identity),
            )
        conn.commit()
    finally:
        conn.close()


def check_illustrate(identity: str | None) -> None:
    """Raise BudgetExceeded if today's image-generation caps are already spent."""
    day = _today()
    conn = _conn()
    try:
        row = conn.execute(
            "SELECT requests FROM illustrate_daily WHERE day = ?", (day,)
        ).fetchone()
        if row and row[0] >= config.KID_ART_DAILY_CAP:
            raise BudgetExceeded("daily-illustrations")
        if identity:
            urow = conn.execute(
                "SELECT requests FROM illustrate_by_user WHERE day = ? AND identity = ?",
                (day, identity),
            ).fetchone()
            if urow and urow[0] >= config.KID_ART_DAILY_CAP_PER_USER:
                raise BudgetExceeded("user-illustrations")
    finally:
        conn.close()


def record_illustrate(identity: str | None) -> None:
    day = _today()
    conn = _conn()
    try:
        conn.execute(
            """INSERT INTO illustrate_daily (day, requests) VALUES (?, 1)
               ON CONFLICT(day) DO UPDATE SET requests = requests + 1""",
            (day,),
        )
        if identity:
            conn.execute(
                """INSERT INTO illustrate_by_user (day, identity, requests) VALUES (?, ?, 1)
                   ON CONFLICT(day, identity) DO UPDATE SET requests = requests + 1""",
                (day, identity),
            )
        conn.commit()
    finally:
        conn.close()


def snapshot() -> dict:
    day = _today()
    conn = _conn()
    try:
        row = conn.execute(
            "SELECT requests, input_tokens, output_tokens FROM usage_daily WHERE day = ?",
            (day,),
        ).fetchone() or (0, 0, 0)
    finally:
        conn.close()
    return {
        "day": day,
        "requests": row[0],
        "input_tokens": row[1],
        "output_tokens": row[2],
        "request_cap": config.DAILY_REQUEST_CAP,
        "token_cap": config.DAILY_TOKEN_CAP,
    }
