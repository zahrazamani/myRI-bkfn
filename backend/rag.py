"""Retrieval-augmented context lookup.

Pipeline:  query -> embed (Google) -> cache check -> vector search (Chroma, k=FETCH_K)
           -> local cross-encoder rerank -> keep TOP_K -> cache store.
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


def _filter_for(chatbot_id: str):
    extra = _ALSO_READS.get(chatbot_id)
    if extra:
        return {"$or": [{"chatbot_id": chatbot_id}, {"chatbot_id": extra}]}
    return {"chatbot_id": chatbot_id}


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

    try:
        if embedding is not None:
            docs = vectorstore.similarity_search_by_vector(
                embedding, k=config.RAG_FETCH_K, filter=_filter_for(chatbot_id)
            )
        else:
            docs = vectorstore.similarity_search(
                query, k=config.RAG_FETCH_K, filter=_filter_for(chatbot_id)
            )
    except Exception as exc:
        log.error("vector search failed: %s", exc)
        return {"context": "", "sources": [], "cache": "error"}

    docs = reranker.rerank(query, docs, config.RAG_TOP_K)

    context = "\n\n---\n\n".join(d.page_content for d in docs)
    sources = list(dict.fromkeys(d.metadata.get("source", "Unknown") for d in docs))

    rag_cache.put(chatbot_id, query, embedding, context, sources)
    return {"context": context, "sources": sources, "cache": "miss"}
