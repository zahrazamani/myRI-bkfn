from rag import retrieve_documents
import database
import dotenv
from typing import List, Optional

dotenv.load_dotenv()

# Initialize DB
database.init_db()

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueryRequest(BaseModel):
    query: str
    chatbotId: str

class LogMessageRequest(BaseModel):
    sessionId: str
    chatbotId: str
    chatbotTitle: str
    sender: str
    message: str
    sources: Optional[List[str]] = None

@app.post("/query")
async def query_endpoint(request: QueryRequest):
    try:
        result = retrieve_documents(request.query, request.chatbotId)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/log")
async def log_endpoint(request: LogMessageRequest):
    try:
        database.log_message(
            request.sessionId, 
            request.chatbotId, 
            request.chatbotTitle, 
            request.sender, 
            request.message, 
            request.sources
        )
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/logs")
async def get_logs_endpoint(chatbotId: Optional[str] = None):
    try:
        logs = database.get_logs(chatbotId)
        return logs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/logs")
async def clear_logs_endpoint():
    try:
        database.clear_logs()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {"message": "RAG Backend is running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
