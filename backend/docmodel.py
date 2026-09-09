"""Minimal document model - a drop-in for the one piece of langchain_core we used.

`page_content` + `metadata`, nothing else. rag.py builds these from Chroma query
results; ingest.py builds them from PDFs / the Tafsir DB; reranker.py reads
`.page_content`.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Doc:
    page_content: str
    metadata: dict = field(default_factory=dict)
