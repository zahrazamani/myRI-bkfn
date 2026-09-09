"""A small recursive character text splitter.

Replaces langchain_text_splitters.RecursiveCharacterTextSplitter for ingest.py.
Same idea: break the text down on the coarsest separator that yields pieces
under `chunk_size`, then glue neighbouring pieces back into chunks of about
`chunk_size` with `chunk_overlap` characters of trailing context carried into
the next chunk. Each chunk records its start offset in the source document as
metadata["start_index"] (only used for debugging / dedup).

Only ingest.py uses this, so it only matters when the corpus is re-embedded.
"""
from __future__ import annotations

from docmodel import Doc

_SEPARATORS = ["\n\n", "\n", " ", ""]


def _split_recursive(text: str, separators: list[str], chunk_size: int) -> list[str]:
    if len(text) <= chunk_size:
        return [text] if text else []

    sep = separators[-1]
    remaining: list[str] = []
    for i, s in enumerate(separators):
        if s == "":
            sep, remaining = "", []
            break
        if s in text:
            sep, remaining = s, separators[i + 1:]
            break

    parts = list(text) if sep == "" else text.split(sep)
    out: list[str] = []
    for p in parts:
        if not p:
            continue
        if len(p) <= chunk_size:
            out.append(p)
        elif remaining:
            out.extend(_split_recursive(p, remaining, chunk_size))
        else:
            out.extend(p[j:j + chunk_size] for j in range(0, len(p), chunk_size))
    return out


def split_text(text: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> list[tuple[str, int]]:
    """Return [(chunk_text, start_index), ...]."""
    if not text:
        return []

    splits = _split_recursive(text, list(_SEPARATORS), chunk_size)
    chunks: list[str] = []
    buf: list[str] = []
    buf_len = 0

    def buf_join() -> str:
        return " ".join(buf)

    for s in splits:
        extra = len(s) + (1 if buf else 0)
        if buf and buf_len + extra > chunk_size:
            chunks.append(buf_join())
            # carry an overlap tail into the next chunk
            overlap: list[str] = []
            olen = 0
            for prev in reversed(buf):
                if overlap and olen + len(prev) + 1 > chunk_overlap:
                    break
                overlap.insert(0, prev)
                olen += len(prev) + 1
            buf = overlap
            buf_len = sum(len(x) for x in buf) + max(0, len(buf) - 1)
        buf.append(s)
        buf_len += len(s) + (1 if len(buf) > 1 else 0)
    if buf:
        chunks.append(buf_join())

    # Best-effort start offsets (metadata only - nothing reads them for
    # retrieval). Bias each search forward past the previous chunk minus overlap.
    result: list[tuple[str, int]] = []
    pos = 0
    for c in chunks:
        head = c[:40]
        idx = text.find(head, pos)
        if idx == -1:
            idx = text.find(head)
        if idx == -1:
            idx = pos
        result.append((c, idx))
        pos = max(pos, idx + max(1, len(c) - chunk_overlap - 40))
    return result


def split_documents(docs: list[Doc], chunk_size: int = 1000, chunk_overlap: int = 200) -> list[Doc]:
    out: list[Doc] = []
    for d in docs:
        for chunk_text, start_index in split_text(d.page_content, chunk_size, chunk_overlap):
            meta = dict(d.metadata)
            meta["start_index"] = start_index
            out.append(Doc(page_content=chunk_text, metadata=meta))
    return out
