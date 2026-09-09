"""Local cross-encoder reranker.

Keeps zero per-query API cost: the vector store gives us a coarse candidate set,
this reorders it by true query-document relevance. Multilingual model so the
Persian (my-compass) corpus reranks correctly too.

The model (~0.5 GB) is downloaded once from Hugging Face on first use and cached
under ~/.cache/huggingface. If sentence-transformers / torch aren't installed the
reranker degrades gracefully to a no-op (candidates are returned in vector order).
"""
from __future__ import annotations

import logging

import config

log = logging.getLogger("myri.reranker")

_model = None
_load_failed = False


def _get_model():
    global _model, _load_failed
    if _model is not None or _load_failed:
        return _model
    try:
        from sentence_transformers import CrossEncoder

        log.info("loading reranker %s ...", config.RERANKER_MODEL)
        _model = CrossEncoder(config.RERANKER_MODEL, max_length=512)
        log.info("reranker ready")
    except Exception as exc:  # ImportError, download failure, OOM ...
        _load_failed = True
        log.warning("reranker unavailable, falling back to vector order: %s", exc)
    return _model


def rerank(query: str, docs: list, top_k: int) -> list:
    """Return the top_k docs (langchain Document objects) most relevant to query."""
    if not docs:
        return []
    if not config.RERANK_ENABLED or len(docs) <= top_k:
        return docs[:top_k]
    model = _get_model()
    if model is None:
        return docs[:top_k]
    pairs = [(query, d.page_content) for d in docs]
    try:
        scores = model.predict(pairs)
    except Exception as exc:
        log.warning("rerank failed, using vector order: %s", exc)
        return docs[:top_k]
    ranked = sorted(zip(docs, scores), key=lambda t: t[1], reverse=True)
    return [d for d, _ in ranked[:top_k]]


def warm_up() -> None:
    """Optionally trigger the model download at startup instead of first request."""
    _get_model()
