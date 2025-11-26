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
    
    # 1. Load from SQLite (Tafsir Al-Mizan)
    sqlite_path = os.path.join(DATA_PATH, "tafsir_almizan_en.db")
    if os.path.exists(sqlite_path):
        print(f"Loading Tafsir Al-Mizan from {sqlite_path}...")
        try:
            conn = sqlite3.connect(sqlite_path)
            cursor = conn.cursor()
            
            # Load Content
            cursor.execute("SELECT content FROM content")
            rows = cursor.fetchall()
            for row in rows:
                if row[0]:
                    documents.append(Document(
                        page_content=row[0],
                        metadata={"chatbot_id": "tafsir", "source": "Tafsir Al-Mizan"}
                    ))
            
            # Load Introduction (Muqadimah)
            cursor.execute("SELECT content FROM muqadimah")
            rows = cursor.fetchall()
            for row in rows:
                if row[0]:
                    documents.append(Document(
                        page_content=row[0],
                        metadata={"chatbot_id": "tafsir", "source": "Tafsir Al-Mizan (Intro)"}
                    ))
            
            conn.close()
            print(f"Loaded {len(documents)} documents from SQLite.")
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

    # Create a new DB from the documents.
    db = Chroma.from_documents(
        chunks, 
        GoogleGenerativeAIEmbeddings(model="models/text-embedding-004", google_api_key=api_key), 
        persist_directory=CHROMA_PATH
    )
    print(f"Saved {len(chunks)} chunks to {CHROMA_PATH}.")

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
