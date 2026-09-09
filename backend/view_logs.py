"""Read chat logs from the command line (S1).

The in-app Log Viewer can't work in a real deployment - the admin token can't
ship in a browser bundle - so read the transcripts here instead, over SSH or
`docker compose exec app python view_logs.py`. For a spreadsheet, use
`export_feedback.py`.

Examples
--------
    python view_logs.py                         # 20 most recent sessions, summary
    python view_logs.py --bot guardians-club    # only that bot
    python view_logs.py --since 2026-09-01      # sessions started on/after a date
    python view_logs.py --limit 5 --full        # print full transcripts
    python view_logs.py --session <session_id>  # one full transcript
    python view_logs.py --stats                 # per-bot counts only
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import textwrap

import config

MSG_WRAP = 100


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _has_sessions_table(conn: sqlite3.Connection) -> bool:
    return bool(conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='chat_sessions'"
    ).fetchone())


def cmd_stats(conn: sqlite3.Connection) -> None:
    rows = conn.execute(
        """SELECT chatbot_id,
                  COUNT(DISTINCT session_id) AS sessions,
                  COUNT(*) AS messages,
                  MIN(timestamp) AS first, MAX(timestamp) AS last
           FROM chat_logs GROUP BY chatbot_id ORDER BY sessions DESC"""
    ).fetchall()
    if not rows:
        print("(no logs yet)")
        return
    print(f"{'bot':24}{'sessions':>10}{'messages':>10}   {'first':<20}{'last':<20}")
    for r in rows:
        print(f"{r['chatbot_id']:24}{r['sessions']:>10}{r['messages']:>10}   "
              f"{(r['first'] or '')[:19]:<20}{(r['last'] or '')[:19]:<20}")


def _session_rows(conn, bot, since, limit):
    where, params = [], []
    if bot:
        where.append("chatbot_id = ?"); params.append(bot)
    if since:
        where.append("timestamp >= ?"); params.append(since)
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    if _has_sessions_table(conn):
        return conn.execute(
            f"""SELECT session_id, chatbot_id, chatbot_title, identity_hash, language,
                       started_at, num_messages, num_user_messages
                FROM chat_sessions {clause.replace('timestamp', 'started_at')}
                ORDER BY started_at DESC LIMIT ?""",
            (*params, limit),
        ).fetchall()
    # older DB with no chat_sessions table: derive from chat_logs
    return conn.execute(
        f"""SELECT session_id,
                   MAX(chatbot_id) chatbot_id, MAX(chatbot_title) chatbot_title,
                   NULL identity_hash, NULL language,
                   MIN(timestamp) started_at, COUNT(*) num_messages,
                   SUM(sender='user') num_user_messages
            FROM chat_logs {clause} GROUP BY session_id
            ORDER BY started_at DESC LIMIT ?""",
        (*params, limit),
    ).fetchall()


def _print_transcript(conn, session_id: str) -> None:
    msgs = conn.execute(
        "SELECT sender, message, sources FROM chat_logs WHERE session_id = ? ORDER BY id",
        (session_id,),
    ).fetchall()
    for m in msgs:
        who = "USER" if m["sender"] == "user" else "BOT "
        body = textwrap.fill(m["message"] or "", MSG_WRAP,
                             subsequent_indent="      ", initial_indent="      ")
        print(f"  {who} |")
        print(body)
        if m["sources"]:
            try:
                srcs = ", ".join(json.loads(m["sources"]))
            except (ValueError, TypeError):
                srcs = m["sources"]
            print(f"       sources: {srcs}")
        print()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--db", help="override MYRI_DB_PATH")
    ap.add_argument("--bot", help="filter by chatbot_id")
    ap.add_argument("--since", help="ISO date/datetime lower bound")
    ap.add_argument("--limit", type=int, default=20)
    ap.add_argument("--full", action="store_true", help="print each session's transcript")
    ap.add_argument("--session", help="print one full transcript by session_id")
    ap.add_argument("--stats", action="store_true", help="per-bot counts only")
    args = ap.parse_args()

    if args.db:
        config.DB_PATH = args.db

    conn = _conn()
    try:
        if not conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='chat_logs'"
        ).fetchone():
            print(f"No chat_logs table in {config.DB_PATH} - has anyone chatted yet?")
            return

        if args.session:
            _print_transcript(conn, args.session)
            return
        if args.stats:
            cmd_stats(conn)
            return

        rows = _session_rows(conn, args.bot, args.since, args.limit)
        if not rows:
            print("(no matching sessions)")
            return
        for r in rows:
            lang = f" [{r['language']}]" if r["language"] else ""
            uh = f" user={r['identity_hash']}" if r["identity_hash"] else ""
            print(f"\n=== {r['chatbot_id']}{lang}  {(r['started_at'] or '')[:19]}  "
                  f"{r['num_user_messages']}q / {r['num_messages']} msgs{uh}")
            print(f"    session: {r['session_id']}")
            if args.full:
                print()
                _print_transcript(conn, r["session_id"])
    finally:
        conn.close()


if __name__ == "__main__":
    main()
