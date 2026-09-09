"""
Build the Chroma vector store the chatbots retrieve from.

Sources
-------
* PDFs under ``documents/<folder>/`` - extracted with **PyMuPDF** (much cleaner
  than pypdf on the Google-Docs-rendered books, which pypdf broke into one word
  per line) and run through a whitespace-repair pass.
* ``documents/**/tafsir_almizan_en.db`` - Tafsir al-Mizan, already clean, joined
  to ``ayah_mapping`` for a precise per-passage citation.

Every chunk carries clean metadata so the model can cite it and the UI "Sources"
chips read nicely:
    source    - human title  ("Divine Justice")
    citation  - "Divine Justice - Chapter Two: ..."  or  "... , p. 42"
    title / author / page / chatbot_id

Re-ingest
---------
    ./venv/bin/python ingest.py            # rebuild everything
    ./venv/bin/python ingest.py --dry-run  # load + clean + chunk, no embedding

The new store is built in ``chroma_db.building`` and swapped in atomically at the
end, so a server pointed at ``chroma_db`` keeps serving the old store for the
~40 min the rebuild takes (restart it afterwards to pick up the new one).
"""
from __future__ import annotations

import argparse
import glob
import os
import re
import shutil
import sqlite3
import sys
import time

import uuid

import chromadb
import dotenv
import pymupdf

import embeddings
import textsplit
from docmodel import Doc as Document  # same shape: .page_content + .metadata

dotenv.load_dotenv()

# The collection name the old langchain store used; rag.py reads it back by this
# name, so keep it stable.
COLLECTION_NAME = "langchain"

DATA_PATH = "./documents"
CHROMA_PATH = "./chroma_db"
BUILD_PATH = "./chroma_db.building"
EMBED_MODEL = os.environ.get("MYRI_EMBED_MODEL", "models/gemini-embedding-001")

# documents/<folder>/ -> which bot's corpus these files belong to
FOLDER_TO_BOT_ID = {
    "journey": "journey-beliefs",
    "superhero": "superhero-universe",
    "compass": "my-compass",
    "daily": "daily-dialogue",
}

# Clean citation info per PDF. Keyed by file name. Anything not listed still gets
# ingested - it just falls back to a title derived from the file name.
PDF_SOURCES: dict[str, dict[str, str]] = {
    "Andisheye_islami1.pdf": {
        "title": "Islamic Thought 1 (Andisheh-ye Islami)",
        "author": "",
    },
    "Andisheye_Islami2_eng.pdf": {
        "title": "Islamic Thought 2 (Andisheh-ye Islami)",
        "author": "",
    },
    "Shia in Islam.pdf": {
        "title": "Shi'a in Islam",
        "author": "Muhammad Husayn Tabataba'i",
    },
    "divine_justice.pdf": {
        "title": "Divine Justice ('Adl-e Ilahi)",
        "author": "Murtadha Mutahhari",
    },
    "man_and_his_destiny.pdf": {
        "title": "Man and His Destiny",
        "author": "Murtadha Mutahhari",
    },
    "english-islamic-laws-4th-edition.pdf": {
        "title": "Islamic Laws (4th Edition)",
        "author": "Sayyid Ali Husaini Sistani",
    },
    "islamic-laws-sistani-en.pdf": {
        "title": "A Code of Practice for Muslims in the West",
        "author": "Sayyid Ali Husaini Sistani",
    },
    "jami-al-saadat-en.pdf": {
        "title": "Jami' al-Sa'adat (The Collector of Felicities)",
        "author": "Muhammad Mahdi Naraqi",
    },
}

# ----------------------------------------------------------------------------- #
# text cleanup                                                                  #
# ----------------------------------------------------------------------------- #

_JUNK_TOC = re.compile(
    r"author\(s\)|publisher\(s\)|isbn|translator|editor|^\W*$"
    r"|^[0-9a-f]{16,}\.pdf$|tags?:?\s*$|category|featured|miscellaneous"
    r"|get (pdf|epub|mobi)|^\s*(share|download|print)\s*$|topic tags|person tags",
    re.I,
)


def _clean_text(raw: str) -> str:
    """Repair PDF text: de-hyphenate, join wrapped lines, keep paragraph breaks."""
    if not raw:
        return ""
    text = raw.replace("\r\n", "\n").replace("\xa0", " ")
    # word-break hyphen at end of a line -> join
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)
    # normalise runs of blank lines to a single paragraph separator
    text = re.sub(r"\n[ \t]*\n[ \t\n]*", " ", text)

    paras = []
    for para in text.split(" "):
        # a single newline inside a paragraph is a soft line-wrap -> space
        joined = re.sub(r"[ \t]*\n[ \t]*", " ", para)
        joined = re.sub(r"[ \t]{2,}", " ", joined).strip()
        if joined:
            paras.append(joined)
    out = "\n\n".join(paras)

    # pathological fallback: still far more newlines than spaces (pypdf-style)
    if out.count("\n") > out.count(" ") * 0.5:
        out = " ".join(raw.split())
    return out


def _toc_chapter(toc: list, page_no: int) -> str:
    """Best chapter/section title for a 1-based page from the PDF's bookmarks:
    the most recent non-junk heading at or before this page (deepest on ties)."""
    best = ""
    best_key = (-1, -1)  # (start_page, level)
    for level, title, start in toc:
        if start > page_no:
            continue
        title = re.sub(r"\s+", " ", title).strip().rstrip(":")
        if not title or _JUNK_TOC.search(title):
            continue
        if (start, level) >= best_key:
            best, best_key = title, (start, level)
    return best


def _pdf_title(fname: str, doc) -> tuple[str, str]:
    if fname in PDF_SOURCES:
        s = PDF_SOURCES[fname]
        return s["title"], s.get("author", "")
    meta_title = (doc.metadata or {}).get("title", "").strip()
    if meta_title and not meta_title.lower().startswith("microsoft word"):
        return meta_title, (doc.metadata or {}).get("author", "").strip()
    return os.path.splitext(fname)[0].replace("_", " ").strip(), ""


def _load_pdf(path: str, bot_id: str) -> list[Document]:
    fname = os.path.basename(path)
    doc = pymupdf.open(path)
    title, author = _pdf_title(fname, doc)
    toc = doc.get_toc() or []
    docs: list[Document] = []

    for i, page in enumerate(doc):
        page_no = i + 1
        body = _clean_text(page.get_text("text"))
        if len(body) < 120:  # skip covers, blank pages, bare TOC pages
            continue
        chapter = _toc_chapter(toc, page_no)
        citation = f"{title} - {chapter}" if chapter else f"{title}, p. {page_no}"
        docs.append(
            Document(
                page_content=body,
                metadata={
                    "chatbot_id": bot_id,
                    "source": title,
                    "title": title,
                    "author": author,
                    "page": page_no,
                    "citation": citation,
                },
            )
        )
    doc.close()
    print(f"    {fname}: {len(docs)} pages kept  ->  {title}")
    return docs


# ----------------------------------------------------------------------------- #
# loading                                                                       #
# ----------------------------------------------------------------------------- #


def _load_tafsir() -> list[Document]:
    matches = glob.glob(os.path.join(DATA_PATH, "**", "tafsir_almizan_en.db"), recursive=True)
    sqlite_path = matches[0] if matches else os.path.join(DATA_PATH, "tafsir_almizan_en.db")
    if not os.path.exists(sqlite_path):
        return []

    print(f"Loading Tafsir al-Mizan from {sqlite_path} ...")
    documents: list[Document] = []
    try:
        conn = sqlite3.connect(sqlite_path)
        cur = conn.cursor()
        cur.execute(
            "SELECT content_id, surah_number, MIN(ayah_number), MAX(ayah_number) "
            "FROM ayah_mapping GROUP BY content_id"
        )
        ayah_ref = {cid: (s, lo, hi) for cid, s, lo, hi in cur.fetchall()}
        arabic_block = re.compile(r"```arabic.*?```\n*", re.S)

        cur.execute("SELECT content_id, content FROM content")
        for cid, text in cur.fetchall():
            if not text:
                continue
            text = arabic_block.sub("", text).strip()
            meta = {"chatbot_id": "tafsir", "source": "Tafsir al-Mizan"}
            if cid in ayah_ref:
                surah, lo, hi = ayah_ref[cid]
                ref = f"{surah}:{lo}" if lo == hi else f"{surah}:{lo}-{hi}"
                meta.update(
                    surah=surah, ayah_start=lo, ayah_end=hi,
                    citation=f"Tafsir al-Mizan on Surah {ref}",
                )
            documents.append(Document(page_content=text, metadata=meta))

        cur.execute("SELECT content FROM muqadimah")
        for (row,) in cur.fetchall():
            if row:
                documents.append(Document(
                    page_content=row,
                    metadata={
                        "chatbot_id": "tafsir",
                        "source": "Tafsir al-Mizan",
                        "citation": "Tafsir al-Mizan, Introduction",
                    },
                ))
        conn.close()
        print(f"  {len(documents)} Tafsir al-Mizan passages")
    except Exception as e:  # noqa: BLE001
        print(f"  ERROR loading Tafsir DB: {e}")
    return documents


def load_documents() -> list[Document]:
    documents = _load_tafsir()

    for folder, bot_id in FOLDER_TO_BOT_ID.items():
        folder_path = os.path.join(DATA_PATH, folder)
        if not os.path.isdir(folder_path):
            continue
        pdfs = sorted(glob.glob(os.path.join(folder_path, "*.pdf")))
        if not pdfs:
            continue
        print(f"Loading {bot_id} ({len(pdfs)} PDF(s)) from {folder_path} ...")
        for pdf in pdfs:
            documents.extend(_load_pdf(pdf, bot_id))

    return documents


def split_text(documents: list[Document]) -> list[Document]:
    chunks = textsplit.split_documents(documents, chunk_size=1000, chunk_overlap=200)
    print(f"Split {len(documents)} documents into {len(chunks)} chunks.")
    return chunks


# ----------------------------------------------------------------------------- #
# embedding + store                                                             #
# ----------------------------------------------------------------------------- #

EMBED_BATCH_SIZE = 100
MAX_RETRIES = 6


def _clean_meta(meta: dict) -> dict:
    """Chroma metadata values must be str / int / float / bool - drop None and
    empty strings, coerce everything else to str."""
    out = {}
    for k, v in meta.items():
        if v is None or v == "":
            continue
        out[k] = v if isinstance(v, (str, int, float, bool)) else str(v)
    return out


def _add_with_retry(col, batch: list[Document]) -> None:
    for attempt in range(MAX_RETRIES):
        try:
            vectors = embeddings.embed_documents([d.page_content for d in batch])
            col.add(
                ids=[str(uuid.uuid4()) for _ in batch],
                embeddings=vectors,
                documents=[d.page_content for d in batch],
                metadatas=[_clean_meta(d.metadata) for d in batch],
            )
            return
        except Exception as e:  # noqa: BLE001
            msg = str(e)
            transient = any(c in msg for c in ("429", "RESOURCE_EXHAUSTED", "503", "500", "deadline"))
            if not transient or attempt == MAX_RETRIES - 1:
                raise
            wait = min(60, 2 ** attempt * 5)
            print(f"  transient error ({msg[:80]}...); retry in {wait}s")
            time.sleep(wait)


def save_to_chroma(chunks: list[Document]) -> None:
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        sys.exit("ERROR: GOOGLE_API_KEY / GEMINI_API_KEY not set")

    if os.path.exists(BUILD_PATH):
        shutil.rmtree(BUILD_PATH)

    client = chromadb.PersistentClient(path=BUILD_PATH)
    col = client.get_or_create_collection(COLLECTION_NAME)

    total = len(chunks)
    for start in range(0, total, EMBED_BATCH_SIZE):
        _add_with_retry(col, chunks[start:start + EMBED_BATCH_SIZE])
        print(f"  embedded {min(start + EMBED_BATCH_SIZE, total)}/{total}")

    # Release the SQLite handle on the freshly built store before the rename.
    del col
    del client

    # atomic-ish swap: the gap where chroma_db doesn't exist is milliseconds.
    # A running server holds its SQLite handle open across the rename and keeps
    # serving the old store until it restarts - which is what we want.
    old = f"{CHROMA_PATH}.old"
    if os.path.exists(old):
        shutil.rmtree(old)
    if os.path.exists(CHROMA_PATH):
        os.rename(CHROMA_PATH, old)
    os.rename(BUILD_PATH, CHROMA_PATH)
    if os.path.exists(old):
        shutil.rmtree(old)
    print(f"Saved {total} chunks to {CHROMA_PATH}. Restart the server to load it.")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="load + clean + chunk, skip embedding")
    args = ap.parse_args()

    if not os.path.isdir(DATA_PATH):
        sys.exit(f"No {DATA_PATH}/ - add the corpus folders first (see documents/README.md)")

    documents = load_documents()
    if not documents:
        sys.exit("No documents found under ./documents")

    chunks = split_text(documents)

    if args.dry_run:
        from collections import Counter
        by_bot = Counter(c.metadata.get("chatbot_id") for c in chunks)
        print("\nchunks by corpus:")
        for k, v in by_bot.most_common():
            print(f"  {k:<20} {v}")
        print("\nsample citations:")
        seen = set()
        for c in chunks:
            cit = c.metadata.get("citation", "")
            key = c.metadata.get("source")
            if key not in seen and cit:
                seen.add(key)
                print(f"  [{key}] {cit}")
        return

    save_to_chroma(chunks)


if __name__ == "__main__":
    main()
