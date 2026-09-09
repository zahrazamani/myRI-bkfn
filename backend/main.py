import logging
import os

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from typing import List, Literal, Optional

import bot_registry
import config
import database
import kid_art
import usage
from chat import generate_reply
from security import (
    issue_session_token,
    limiter,
    require_human,
    verify_turnstile,
)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("myri")

database.init_db()

app = FastAPI(title="MYRI backend")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")


# --------------------------------------------------------------------- models
# String/list length caps below are defense-in-depth against oversized-payload
# cost abuse (a very long message or a very long history still costs real
# model tokens before any per-day budget check ever runs) - see config.py.
class ChatMessageIn(BaseModel):
    role: str
    text: str = Field(default="", max_length=config.CHAT_MESSAGE_MAX_CHARS)


class ChatRequest(BaseModel):
    chatbotId: str
    systemInstruction: str = ""
    messages: List[ChatMessageIn] = Field(max_length=config.CHAT_MESSAGES_MAX_COUNT)
    identity: Optional[str] = None
    # UI language for this conversation. Only "en" / "fa" are honoured; anything
    # else (including the dropped "ar" option) is treated as "en".
    language: Optional[str] = "en"


class VerifyRequest(BaseModel):
    token: str
    identity: Optional[str] = None


class IllustrateRequest(BaseModel):
    storyId: str
    description: str = Field(max_length=config.ILLUSTRATE_DESC_MAX_CHARS)
    identity: Optional[str] = None


class LogMessageRequest(BaseModel):
    sessionId: str = Field(max_length=config.LOG_FIELD_MAX_CHARS)
    chatbotId: str = Field(max_length=config.LOG_FIELD_MAX_CHARS)
    chatbotTitle: str = Field(max_length=config.LOG_FIELD_MAX_CHARS)
    # Restricting to the two real roles closes off using this endpoint to
    # write arbitrary "sender" strings into the transcript store.
    sender: Literal["user", "bot"]
    message: str = Field(default="", max_length=config.LOG_MESSAGE_MAX_CHARS)
    sources: Optional[List[str]] = None


# --------------------------------------------------------------------- routes
@app.get("/health")
async def health():
    return {"status": "ok", "usage": usage.snapshot()}


@app.post("/verify")
@limiter.limit("10/minute;60/hour")
async def verify_endpoint(request: Request, body: VerifyRequest):
    ok = await verify_turnstile(body.token, _client_ip(request))
    if not ok:
        raise HTTPException(status_code=400, detail="verification-failed")
    return {"token": issue_session_token(body.identity)}


@app.post("/chat")
@limiter.limit(config.RATE_LIMIT_CHAT)
async def chat_endpoint(request: Request, body: ChatRequest, _human=Depends(require_human)):
    # Reject anything outside the six real bots up front, rather than letting an
    # unknown chatbotId fall through with no RAG grounding and no server-side
    # identity lock (see bot_registry.py) applied to it.
    if body.chatbotId not in bot_registry.KNOWN_BOT_IDS:
        raise HTTPException(status_code=400, detail="unknown-chatbot")
    identity = (body.identity or "").strip().lower() or None
    try:
        usage.check(identity)
    except usage.BudgetExceeded as exc:
        return JSONResponse(
            status_code=429,
            content={"error": "resting", "scope": exc.scope, "message": config.RESTING_MESSAGE},
        )
    try:
        language = "fa" if (body.language or "en").strip().lower() == "fa" else "en"
        result = generate_reply(
            body.chatbotId,
            body.systemInstruction,
            [m.model_dump() for m in body.messages],
            language=language,
        )
    except Exception as exc:
        log.exception("generation failed")
        raise HTTPException(status_code=502, detail=f"generation-failed: {exc}")

    usage.record(identity, result["input_tokens"], result["output_tokens"])
    return {"text": result["text"], "sources": result["sources"]}


@app.post("/illustrate")
@limiter.limit(config.RATE_LIMIT_ILLUSTRATE)
async def illustrate_endpoint(request: Request, body: IllustrateRequest, _human=Depends(require_human)):
    """The guardians-club "bring it to life" feature: a child's own description of
    a story scene -> one illustration in that story's art style."""
    if not config.KID_ART_ENABLED:
        raise HTTPException(status_code=503, detail="kid-art-disabled")
    identity = (body.identity or "").strip().lower() or None
    try:
        usage.check(identity)
        usage.check_illustrate(identity)
    except usage.BudgetExceeded as exc:
        return JSONResponse(
            status_code=429,
            content={"error": "resting", "scope": exc.scope, "message": config.RESTING_MESSAGE},
        )
    try:
        image_b64, mime = kid_art.generate_kid_illustration(body.storyId, body.description)
    except kid_art.UnknownStory:
        raise HTTPException(status_code=400, detail="unknown-story")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        log.exception("kid illustration failed")
        raise HTTPException(status_code=502, detail=f"illustration-failed: {exc}")

    usage.record(identity)  # also counts toward the shared daily request cap
    usage.record_illustrate(identity)
    return {"image": f"data:{mime};base64,{image_b64}"}


@app.post("/log")
@limiter.limit("120/minute")
async def log_endpoint(request: Request, body: LogMessageRequest, _human=Depends(require_human)):
    # Previously had no auth at all: anyone could write arbitrary transcript rows
    # (fake sessions, unlimited storage growth) into logs.db without ever having
    # called /chat. Same human-verification gate as /chat and /illustrate now
    # applies here too - see frontend/services/loggingService.ts for the matching
    # Authorization header.
    try:
        database.log_message(
            body.sessionId, body.chatbotId, body.chatbotTitle,
            body.sender, body.message, body.sources,
        )
        return {"status": "success"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


def _require_admin(x_admin_token: Optional[str] = Header(default=None)):
    admin = os.environ.get("MYRI_ADMIN_TOKEN", "")
    if not admin or x_admin_token != admin:
        raise HTTPException(status_code=403, detail="admin-only")


@app.get("/logs", dependencies=[Depends(_require_admin)])
async def get_logs_endpoint(chatbotId: Optional[str] = None):
    return database.get_logs(chatbotId)


@app.delete("/logs", dependencies=[Depends(_require_admin)])
async def clear_logs_endpoint():
    database.clear_logs()
    return {"status": "success"}


# --------------------------------------------------------------------- static
frontend_dist = os.path.join(os.path.dirname(__file__), "../frontend/dist")
if os.path.isdir(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    illus_dir = os.path.join(frontend_dist, "illustrations")
    if os.path.isdir(illus_dir):
        app.mount("/illustrations", StaticFiles(directory=illus_dir), name="illustrations")

    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(frontend_dist, "index.html"))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
