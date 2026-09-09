import re
import sqlite3
import json
import hashlib
from datetime import datetime, timezone

import config

# S6: honour the configured path (MYRI_DB_PATH). In Docker this is /data/logs.db
# on the mounted volume; hardcoding "logs.db" wrote chat logs to the container's
# ephemeral filesystem, so they were lost on every redeploy. usage.py and
# rag_cache.py already read config.DB_PATH. Tests monkeypatch database.DB_PATH.
DB_PATH = config.DB_PATH

# Many of MYRI's users are minors. /logs is admin-token gated, but a leaked
# token or a DB backup shouldn't hand over anything a child typed that looks
# like an email or phone number. Best-effort, not a substitute for keeping the
# admin token secret - see backend/security.py.
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE_RE = re.compile(r"(?<!\d)(?:\+?\d[\s.-]?){7,15}(?!\d)")


def _redact_pii(text: str | None) -> str | None:
    if not text:
        return text
    text = _EMAIL_RE.sub("[email redacted]", text)
    text = _PHONE_RE.sub("[number redacted]", text)
    return text


def _identity_hash(identity: str | None) -> str | None:
    """A stable, non-reversible tag so sessions can be grouped by user for
    monitoring without storing the (unverified) login email in the log store."""
    ident = (identity or "").strip().lower()
    if not ident:
        return None
    return hashlib.sha256(ident.encode("utf-8")).hexdigest()[:16]


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    conn = _connect()
    cursor = conn.cursor()
    # One row per message.
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            chatbot_id TEXT NOT NULL,
            chatbot_title TEXT,
            timestamp TEXT,
            sender TEXT NOT NULL,
            message TEXT,
            sources TEXT
        )
    ''')
    # S1: one row per session, written once at session end. Makes the queries
    # you actually run for monitoring ("how many sessions per bot this week",
    # "which sessions ran long") a single indexed lookup instead of a GROUP BY
    # over every message.
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS chat_sessions (
            session_id TEXT PRIMARY KEY,
            chatbot_id TEXT NOT NULL,
            chatbot_title TEXT,
            identity_hash TEXT,
            language TEXT,
            started_at TEXT,
            ended_at TEXT,
            num_messages INTEGER NOT NULL DEFAULT 0,
            num_user_messages INTEGER NOT NULL DEFAULT 0
        )
    ''')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_chat_logs_session ON chat_logs(session_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_chat_logs_bot_ts ON chat_logs(chatbot_id, timestamp)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_chat_sessions_bot ON chat_sessions(chatbot_id, started_at)')
    conn.commit()
    conn.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def log_message(session_id, chatbot_id, chatbot_title, sender, message, sources=None):
    """Append a single message row. Kept for tests / one-off writes; the app
    logs a whole session at once via log_session()."""
    conn = _connect()
    cursor = conn.cursor()
    sources_json = json.dumps(sources) if sources else None
    message = _redact_pii(message)
    cursor.execute('''
        INSERT INTO chat_logs (session_id, chatbot_id, chatbot_title, timestamp, sender, message, sources)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (session_id, chatbot_id, chatbot_title, _now(), sender, message, sources_json))
    conn.commit()
    conn.close()


def log_session(session_id, chatbot_id, chatbot_title, messages, identity=None, language=None):
    """Write a whole finished conversation in ONE transaction (S2).

    `messages` is a list of {sender, text, sources?} in order. Idempotent per
    session_id: re-posting the same session replaces its rows rather than
    duplicating them.
    """
    ts = _now()
    conn = _connect()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM chat_logs WHERE session_id = ?", (session_id,))
        rows = []
        num_user = 0
        for m in messages:
            sender = "user" if (m.get("sender") or m.get("role")) == "user" else "bot"
            if sender == "user":
                num_user += 1
            rows.append((
                session_id, chatbot_id, chatbot_title, ts, sender,
                _redact_pii(m.get("text") or m.get("message") or ""),
                json.dumps(m["sources"]) if m.get("sources") else None,
            ))
        cur.executemany('''
            INSERT INTO chat_logs (session_id, chatbot_id, chatbot_title, timestamp, sender, message, sources)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', rows)
        cur.execute('''
            INSERT INTO chat_sessions
                (session_id, chatbot_id, chatbot_title, identity_hash, language,
                 started_at, ended_at, num_messages, num_user_messages)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                ended_at = excluded.ended_at,
                num_messages = excluded.num_messages,
                num_user_messages = excluded.num_user_messages,
                language = excluded.language
        ''', (
            session_id, chatbot_id, chatbot_title, _identity_hash(identity),
            (language or None), ts, ts, len(rows), num_user,
        ))
        conn.commit()
    finally:
        conn.close()


def get_logs(chatbot_id=None):
    conn = _connect()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    if chatbot_id:
        cursor.execute('SELECT * FROM chat_logs WHERE chatbot_id = ? ORDER BY id DESC', (chatbot_id,))
    else:
        cursor.execute('SELECT * FROM chat_logs ORDER BY id DESC')

    rows = cursor.fetchall()
    conn.close()

    # Group by session_id, newest session first, messages chronological within.
    sessions: dict[str, dict] = {}
    for row in rows:
        sid = row['session_id']
        if sid not in sessions:
            sessions[sid] = {
                'id': sid,
                'chatbotId': row['chatbot_id'],
                'chatbotTitle': row['chatbot_title'],
                'timestamp': row['timestamp'],
                'messages': [],
            }
        sessions[sid]['messages'].insert(0, {
            'sender': row['sender'],
            'text': row['message'],
            'sources': json.loads(row['sources']) if row['sources'] else [],
        })

    return list(sessions.values())


def clear_logs():
    conn = _connect()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM chat_logs')
    cursor.execute('DELETE FROM chat_sessions')
    conn.commit()
    conn.close()
