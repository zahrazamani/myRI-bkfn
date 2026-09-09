"""Retrieval-augmented context lookup.

Pipeline:  query -> embed (Google) -> cache check
           -> one vector search PER corpus tag (k=FETCH_K each), merged
           -> local cross-encoder rerank -> keep TOP_K -> cache store.

Searching each corpus separately matters because the store is ~88% Tafsir
al-Mizan: a single filtered search would hand the reranker almost nothing from
a bot's own (much smaller) book collection. Per-tag search guarantees each
corpus gets a fair FETCH_K candidates before the reranker picks the best.
"""
import logging

from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import Chroma

import config
import rag_cache
import reranker

log = logging.getLogger("myri.rag")

_embeddings = None
_vectorstore = None

# Bots that also read a second corpus in the shared store, by the extra
# chatbot_id tag to include. Tafsir al-Mizan is tagged "tafsir"; Better Me shares
# Superhero Universe's copy of Jami' al-Sa'adat.
_ALSO_READS: dict[str, str] = {
    "guardians-club": "tafsir",
    "daily-dialogue": "tafsir",
    "journey-beliefs": "tafsir",
    "better-me": "superhero-universe",
}


def _corpus_tags(chatbot_id: str) -> list[str]:
    tags = [chatbot_id]
    extra = _ALSO_READS.get(chatbot_id)
    if extra:
        tags.append(extra)
    return tags


def _cite(meta: dict) -> str:
    return meta.get("citation") or meta.get("source") or "Unknown"


def _get_vectorstore():
    global _embeddings, _vectorstore
    if _vectorstore is None:
        if not config.GOOGLE_API_KEY:
            raise ValueError("GOOGLE_API_KEY / GEMINI_API_KEY not set")
        _embeddings = GoogleGenerativeAIEmbeddings(
            model=config.EMBED_MODEL, google_api_key=config.GOOGLE_API_KEY
        )
        _vectorstore = Chroma(
            persist_directory=config.CHROMA_PATH, embedding_function=_embeddings
        )
    return _vectorstore


def _search_tag(vectorstore, embedding, query: str, tag: str, k: int) -> list:
    flt = {"chatbot_id": tag}
    if embedding is not None:
        return vectorstore.similarity_search_by_vector(embedding, k=k, filter=flt)
    return vectorstore.similarity_search(query, k=k, filter=flt)


def retrieve_documents(query: str, chatbot_id: str) -> dict:
    query = (query or "").strip()
    if not query:
        return {"context": "", "sources": [], "cache": "empty-query"}

    vectorstore = _get_vectorstore()

    # One embedding call, reused for cache lookup and vector search.
    embedding = None
    try:
        embedding = _embeddings.embed_query(query)
    except Exception as exc:
        log.warning("embed_query failed (%s); continuing without semantic cache", exc)

    cached = rag_cache.get(chatbot_id, query, embedding)
    if cached:
        return cached

    # One search per corpus so the small book collections aren't crowded out by
    # the 37k-passage Tafsir corpus; then merge and let the reranker choose.
    candidates: list = []
    seen: set = set()
    try:
        for tag in _corpus_tags(chatbot_id):
            for d in _search_tag(vectorstore, embedding, query, tag, config.RAG_FETCH_K):
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
