"""SQLite-backed cache for RAG retrieval results.

Retrieval is deterministic for a given (corpus, chatbot, query), so caching it is
safe and cuts an embedding call + a vector search + a rerank on every repeat.
Religious Q&A repeats a lot, so hit rates are high.

Two layers:
  - exact:    normalized query string match
  - semantic: cosine similarity of the query embedding vs recently cached queries
              for the same chatbot (>= threshold -> hit)

Entries are namespaced by a corpus version so a re-ingest invalidates them.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
import time

import numpy as np

import config

_TABLE = "rag_cache"


def corpus_version() -> str:
    if config.CORPUS_VERSION:
        return config.CORPUS_VERSION
    # Fall back to the chroma store's mtime so re-ingesting busts the cache.
    try:
        sqlite_file = os.path.join(config.CHROMA_PATH, "chroma.sqlite3")
        return str(int(os.path.getmtime(sqlite_file)))
    except OSError:
        return "0"


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(config.DB_PATH)
    conn.execute(
        f"""CREATE TABLE IF NOT EXISTS {_TABLE} (
            key TEXT PRIMARY KEY,
            corpus_version TEXT NOT NULL,
            chatbot_id TEXT NOT NULL,
            norm_query TEXT NOT NULL,
            embedding BLOB,
            context TEXT NOT NULL,
            sources TEXT NOT NULL,
            created_at REAL NOT NULL
        )"""
    )
    conn.execute(f"CREATE INDEX IF NOT EXISTS idx_{_TABLE}_bot ON {_TABLE}(chatbot_id, corpus_version)")
    return conn


def _normalize(q: str) -> str:
    q = q.strip().lower()
    q = re.sub(r"\s+", " ", q)
    q = re.sub(r"[^\w\s؀-ۿ]", "", q)  # keep latin + arabic/persian letters
    return q


def _key(chatbot_id: str, norm_query: str) -> str:
    raw = f"{corpus_version()}\n{chatbot_id}\n{norm_query}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def get(chatbot_id: str, query: str, embedding: list[float] | None) -> dict | None:
    if not config.RAG_CACHE_ENABLED:
        return None
    norm = _normalize(query)
    cv = corpus_version()
    conn = _conn()
    try:
        row = conn.execute(
            f"SELECT context, sources FROM {_TABLE} WHERE key = ?",
            (_key(chatbot_id, norm),),
        ).fetchone()
        if row:
            return {"context": row[0], "sources": json.loads(row[1]), "cache": "exact"}

        if not (config.RAG_CACHE_SEMANTIC and embedding):
            return None

        rows = conn.execute(
            f"""SELECT embedding, context, sources FROM {_TABLE}
                WHERE chatbot_id = ? AND corpus_version = ? AND embedding IS NOT NULL
                ORDER BY created_at DESC LIMIT 400""",
            (chatbot_id, cv),
        ).fetchall()
        if not rows:
            return None
        q = np.asarray(embedding, dtype=np.float32)
        q /= np.linalg.norm(q) or 1.0
        best_sim, best = -1.0, None
        for emb_blob, ctx, srcs in rows:
            v = np.frombuffer(emb_blob, dtype=np.float32)
            if v.shape != q.shape:
                continue
            sim = float(np.dot(q, v / (np.linalg.norm(v) or 1.0)))
            if sim > best_sim:
                best_sim, best = sim, (ctx, srcs)
        if best and best_sim >= config.RAG_CACHE_SEMANTIC_THRESHOLD:
            return {"context": best[0], "sources": json.loads(best[1]), "cache": f"semantic:{best_sim:.3f}"}
    finally:
        conn.close()
    return None


def put(chatbot_id: str, query: str, embedding: list[float] | None, context: str, sources: list[str]) -> None:
    if not config.RAG_CACHE_ENABLED:
        return
    norm = _normalize(query)
    emb_blob = None
    if embedding:
        emb_blob = np.asarray(embedding, dtype=np.float32).tobytes()
    conn = _conn()
    try:
        conn.execute(
            f"""INSERT OR REPLACE INTO {_TABLE}
                (key, corpus_version, chatbot_id, norm_query, embedding, context, sources, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                _key(chatbot_id, norm),
                corpus_version(),
                chatbot_id,
                norm,
                emb_blob,
                context,
                json.dumps(sources),
                time.time(),
            ),
        )
        # Trim oldest rows if the table grows too large.
        conn.execute(
            f"""DELETE FROM {_TABLE} WHERE key IN (
                    SELECT key FROM {_TABLE} ORDER BY created_at DESC
                    LIMIT -1 OFFSET ?
                )""",
            (config.RAG_CACHE_MAX_ROWS,),
        )
        conn.commit()
    finally:
        conn.close()
