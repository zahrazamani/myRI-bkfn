"""Retrieval-augmented context lookup.

Pipeline:  query -> embed (Gemini) -> cache check
           -> one vector search PER corpus tag (k=FETCH_K each), merged
           -> local cross-encoder rerank -> keep TOP_K -> cache store.

Searching each corpus separately matters because the store is ~88% Tafsir
al-Mizan: a single filtered search would hand the reranker almost nothing from
a bot's own (much smaller) book collection. Per-tag search guarantees each
corpus gets a fair FETCH_K candidates before the reranker picks the best.

Uses the chromadb client and google-genai embeddings directly (no LangChain).
The store's collection is named "langchain" for historical reasons and is read
as-is - the embeddings in it are gemini-embedding-001 / RETRIEVAL_DOCUMENT, which
embeddings.embed_query matches, so no re-ingest was needed for this change.
"""
import logging

import chromadb

import config
import embeddings
import rag_cache
import reranker
from docmodel import Doc

log = logging.getLogger("myri.rag")

_collection = None

# Bots that also read a second corpus in the shared store, by the extra
# chatbot_id tag to include. Tafsir al-Mizan is tagged "tafsir"; Better Me shares
# Superhero Universe's copy of Jami' al-Sa'adat.
_ALSO_READS: dict[str, str] = {
    "guardians-club": "tafsir",
    "daily-dialogue": "tafsir",
    "journey-beliefs": "tafsir",
    "better-me": "superhero-universe",
}

_COLLECTION_NAME = "langchain"


def _corpus_tags(chatbot_id: str) -> list[str]:
    tags = [chatbot_id]
    extra = _ALSO_READS.get(chatbot_id)
    if extra:
        tags.append(extra)
    return tags


def _cite(meta: dict) -> str:
    return meta.get("citation") or meta.get("source") or "Unknown"


def _get_collection():
    global _collection
    if _collection is None:
        if not config.GOOGLE_API_KEY:
            raise ValueError("GOOGLE_API_KEY / GEMINI_API_KEY not set")
        client = chromadb.PersistentClient(path=config.CHROMA_PATH)
        try:
            _collection = client.get_collection(_COLLECTION_NAME)
        except Exception:
            cols = client.list_collections()
            if not cols:
                raise
            _collection = client.get_collection(cols[0].name)
            log.warning("collection %r not found; using %r", _COLLECTION_NAME, cols[0].name)
    return _collection


def _search_tag(collection, embedding, tag: str, k: int) -> list[Doc]:
    res = collection.query(
        query_embeddings=[embedding],
        n_results=k,
        where={"chatbot_id": tag},
        include=["documents", "metadatas"],
    )
    docs = res.get("documents") or [[]]
    metas = res.get("metadatas") or [[]]
    return [Doc(page_content=d, metadata=m or {}) for d, m in zip(docs[0], metas[0])]


def retrieve_documents(query: str, chatbot_id: str) -> dict:
    query = (query or "").strip()
    if not query:
        return {"context": "", "sources": [], "cache": "empty-query"}

    # One embedding call, reused for cache lookup and vector search.
    embedding = None
    try:
        embedding = embeddings.embed_query(query)
    except Exception as exc:
        log.warning("embed_query failed (%s); continuing without retrieval", exc)

    cached = rag_cache.get(chatbot_id, query, embedding)
    if cached:
        return cached

    if embedding is None:
        # No embedding -> no vector search possible (the stored collection has no
        # embedding function attached). Better to answer un-grounded than crash.
        return {"context": "", "sources": [], "cache": "error"}

    # One search per corpus so the small book collections aren't crowded out by
    # the 37k-passage Tafsir corpus; then merge and let the reranker choose.
    candidates: list[Doc] = []
    seen: set = set()
    try:
        collection = _get_collection()
        for tag in _corpus_tags(chatbot_id):
            for d in _search_tag(collection, embedding, tag, config.RAG_FETCH_K):
                key = (d.metadata.get("source"), d.metadata.get("page"), d.page_content[:100])
                if key in seen:
                    continue
                seen.add(key)
                candidates.append(d)
    except Exception as exc:
        log.error("vector search failed: %s", exc)
        return {"context": "", "sources": [], "cache": "error"}

    docs = reranker.rerank(query, candidates, config.RAG_TOP_K)

    # Label each passage with its citation so the model can attribute accurately.
    context = "\n\n---\n\n".join(f"[{_cite(d.metadata)}]\n{d.page_content}" for d in docs)
    sources = list(dict.fromkeys(_cite(d.metadata) for d in docs))

    rag_cache.put(chatbot_id, query, embedding, context, sources)
    return {"context": context, "sources": sources, "cache": "miss"}
