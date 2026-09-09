"""Google Gemini text embeddings, called directly through google-genai.

Replaces langchain_google_genai.GoogleGenerativeAIEmbeddings. It reproduces that
class's exact defaults so the vector store built before this change stays valid
with no re-ingest:

  * model   models/gemini-embedding-001  (bare id passed to google-genai)
  * dims    full 3072 (no output_dimensionality reduction)
  * task    RETRIEVAL_DOCUMENT for corpus chunks, RETRIEVAL_QUERY for user
            queries - the same split langchain applied for
            embed_documents / embed_query.
"""
from __future__ import annotations

import logging

from google import genai
from google.genai import types

import config

log = logging.getLogger("myri.embeddings")

_client: genai.Client | None = None

# Gemini's embed_content accepts up to 100 inputs per call.
MAX_BATCH = 100


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not config.GOOGLE_API_KEY:
            raise ValueError("GOOGLE_API_KEY / GEMINI_API_KEY not set")
        _client = genai.Client(api_key=config.GOOGLE_API_KEY)
    return _client


def _model_id() -> str:
    # config.EMBED_MODEL is "models/gemini-embedding-001" (langchain style).
    return config.EMBED_MODEL.split("/")[-1]


def _embed(texts: list[str], task_type: str) -> list[list[float]]:
    if not texts:
        return []
    client = _get_client()
    model = _model_id()
    cfg = types.EmbedContentConfig(task_type=task_type)
    out: list[list[float]] = []
    for start in range(0, len(texts), MAX_BATCH):
        chunk = texts[start:start + MAX_BATCH]
        resp = client.models.embed_content(model=model, contents=chunk, config=cfg)
        out.extend(list(e.values) for e in resp.embeddings)
    return out


def embed_query(text: str) -> list[float]:
    return _embed([text], "RETRIEVAL_QUERY")[0]


def embed_documents(texts: list[str]) -> list[list[float]]:
    return _embed(texts, "RETRIEVAL_DOCUMENT")
