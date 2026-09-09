import os
import dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_community.document_loaders import DirectoryLoader, TextLoader, PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Load environment variables
dotenv.load_dotenv()

# Configuration
DATA_PATH = "./documents"
CHROMA_PATH = "./chroma_db"


import sqlite3
from langchain_core.documents import Document

# Map folder names to chatbot IDs
FOLDER_TO_BOT_ID = {
    "journey": "journey-beliefs",
    "superhero": "superhero-universe",
    "compass": "my-compass",
    "daily": "daily-dialogue"
}

def load_documents():
    documents = []
    
    # 1. Load from SQLite (Tafsir Al-Mizan). Search recursively since it lives
    # in a subfolder (documents/noor/), not directly under DATA_PATH.
    import glob
    matches = glob.glob(os.path.join(DATA_PATH, "**", "tafsir_almizan_en.db"), recursive=True)
    sqlite_path = matches[0] if matches else os.path.join(DATA_PATH, "tafsir_almizan_en.db")
    if os.path.exists(sqlite_path):
        print(f"Loading Tafsir Al-Mizan from {sqlite_path}...")
        try:
            import re as _re
            conn = sqlite3.connect(sqlite_path)
            cursor = conn.cursor()

            # Which surah / ayah range each commentary passage covers, so a
            # retrieved chunk can be cited precisely instead of guessed.
            cursor.execute(
                "SELECT content_id, surah_number, MIN(ayah_number), MAX(ayah_number) "
                "FROM ayah_mapping GROUP BY content_id"
            )
            ayah_ref = {cid: (s, lo, hi) for cid, s, lo, hi in cursor.fetchall()}

            # The Arabic ayah is always followed by its English translation in the
            # same passage; drop the Arabic blocks to keep the embedding on-signal.
            arabic_block = _re.compile(r"```arabic.*?```\n*", _re.S)

            cursor.execute("SELECT content_id, content FROM content")
            n_tafsir = 0
            for cid, text in cursor.fetchall():
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
                n_tafsir += 1

            # Introduction (Muqadimah)
            cursor.execute("SELECT content FROM muqadimah")
            for row in cursor.fetchall():
                if row[0]:
                    documents.append(Document(
                        page_content=row[0],
                        metadata={
                            "chatbot_id": "tafsir",
                            "source": "Tafsir al-Mizan (Introduction)",
                            "citation": "Tafsir al-Mizan, Introduction",
                        },
                    ))

            conn.close()
            print(f"Loaded {n_tafsir} Tafsir al-Mizan passages from SQLite.")
        except Exception as e:
            print(f"Error loading SQLite DB: {e}")

    # 2. Iterate through subfolders
    for folder_name, bot_id in FOLDER_TO_BOT_ID.items():
        folder_path = os.path.join(DATA_PATH, folder_name)
        if not os.path.exists(folder_path):
            continue
            
        print(f"Loading documents for {bot_id} from {folder_path}...")
        
        # Load .txt files
        txt_loader = DirectoryLoader(folder_path, glob="*.txt", loader_cls=TextLoader)
        txt_docs = txt_loader.load()
        for doc in txt_docs:
            doc.metadata["chatbot_id"] = bot_id
        documents.extend(txt_docs)
        
        # Load .pdf files
        pdf_loader = DirectoryLoader(folder_path, glob="*.pdf", loader_cls=PyPDFLoader)
        pdf_docs = pdf_loader.load()
        for doc in pdf_docs:
            doc.metadata["chatbot_id"] = bot_id
        documents.extend(pdf_docs)
    
    return documents

def split_text(documents):
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
        add_start_index=True,
    )
    chunks = text_splitter.split_documents(documents)
    print(f"Split {len(documents)} documents into {len(chunks)} chunks.")
    return chunks

EMBED_BATCH_SIZE = 100
MAX_RETRIES = 6


def _embed_with_retry(db, batch):
    """Add one batch to Chroma, retrying with exponential backoff on transient
    errors (rate limits, 5xx). Raises if it still fails after MAX_RETRIES."""
    import time
    for attempt in range(MAX_RETRIES):
        try:
            db.add_documents(batch)
            return
        except Exception as e:
            msg = str(e)
            transient = any(code in msg for code in ("429", "RESOURCE_EXHAUSTED", "503", "500", "deadline"))
            if not transient or attempt == MAX_RETRIES - 1:
                raise
            wait = min(60, 2 ** attempt * 5)
            print(f"  transient error ({msg[:80]}...); retrying in {wait}s")
            time.sleep(wait)


def save_to_chroma(chunks):
    # Check if API key is set
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: GOOGLE_API_KEY or GEMINI_API_KEY not found in environment variables.")
        return

    # Clear out the database first.
    if os.path.exists(CHROMA_PATH):
        import shutil
        shutil.rmtree(CHROMA_PATH)

    embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001", google_api_key=api_key)
    db = Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings)

    # Embed in batches so partial progress is persisted and a mid-run failure
    # doesn't throw away everything already embedded.
    total = len(chunks)
    for start in range(0, total, EMBED_BATCH_SIZE):
        batch = chunks[start:start + EMBED_BATCH_SIZE]
        _embed_with_retry(db, batch)
        print(f"  embedded {min(start + EMBED_BATCH_SIZE, total)}/{total} chunks")

    print(f"Saved {total} chunks to {CHROMA_PATH}.")

def main():
    if not os.path.exists(DATA_PATH):
        os.makedirs(DATA_PATH)
        print(f"Created {DATA_PATH}. Please add subfolders (journey, superhero, compass, daily) with documents.")
        return

    documents = load_documents()
    if not documents:
        print("No documents found in ./documents subfolders")
        return
        
    chunks = split_text(documents)
    save_to_chroma(chunks)

if __name__ == "__main__":
    main()
