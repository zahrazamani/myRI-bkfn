import os
import dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import Chroma

# Load environment variables
dotenv.load_dotenv()

CHROMA_PATH = "./chroma_db"

def retrieve_documents(query: str, chatbot_id: str):
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY or GEMINI_API_KEY not found in environment variables.")

    # Initialize Embeddings
    embeddings = GoogleGenerativeAIEmbeddings(model="models/text-embedding-004", google_api_key=api_key)
    
    # Initialize Vector Store
    vectorstore = Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings)
    
    # Use search_kwargs to filter by metadata
    # We want documents that match the chatbot_id OR are 'common' (if we had common docs)
    
    filter_criteria = {'chatbot_id': chatbot_id}
    
    # Allow Guardians Club and Daily Dialogue to access 'tafsir' documents
    if chatbot_id in ["guardians-club", "daily-dialogue"]:
        filter_criteria = {
            "$or": [
                {'chatbot_id': chatbot_id},
                {'chatbot_id': 'tafsir'}
            ]
        }
    
    retriever = vectorstore.as_retriever(
        search_kwargs={'filter': filter_criteria}
    )

    # Retrieve documents
    docs = retriever.invoke(query)
    
    # Format context
    context = "\n\n---\n\n".join([doc.page_content for doc in docs])
    sources = [doc.metadata.get("source", "Unknown") for doc in docs]
    
    return {
        "context": context,
        "sources": list(set(sources))
    }
