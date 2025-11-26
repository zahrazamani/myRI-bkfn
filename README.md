# MyRI Project with RAG Backend

This project has been restructured to include a Python backend for Retrieval-Augmented Generation (RAG).

## Structure
- `frontend/`: The React application.
- `backend/`: The Python FastAPI server and RAG logic.

## Prerequisites
- Node.js and npm
- Python 3.9+
- A Google Gemini API Key

## Setup and Running

### 1. Backend Setup
Navigate to the backend directory:
```bash
cd backend
```

Create a virtual environment (optional but recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

Install dependencies:
```bash
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory and add your API key:
```
GEMINI_API_KEY=your_api_key_here
```

### 2. Vectorize Documents
To use your own documents for the chatbot:
1. Place your `.txt` files in the `backend/documents/` folder.
2. Run the ingestion script:
```bash
python ingest.py
```
This will split your documents into chunks and store them in a local vector database (`backend/chroma_db`).

### 3. Run the Backend Server
Start the FastAPI server:
```bash
python main.py
```
The server will run on `http://localhost:8000`.

### 4. Run the Frontend
Open a new terminal and navigate to the frontend directory:
```bash
cd frontend
```

Install dependencies (if not already installed):
```bash
npm install
```

Start the development server:
```bash
npm run dev
```
The frontend will be available at `http://localhost:3000` (or whatever port Vite selects).

## How it Works
1. When you chat with the "Journey & Beliefs" bot (id: `journey-beliefs`), the frontend sends your query to the backend (`POST /query`).
2. The backend searches the vector database for relevant document chunks.
3. The backend returns the relevant text context.
4. The frontend sends this context along with your question to the Gemini API to generate an answer based on the documents.
