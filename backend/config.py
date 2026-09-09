"""Central configuration, all overridable via environment / backend/.env."""
import os

import dotenv

dotenv.load_dotenv()


def _bool(name: str, default: bool) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


def _int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")

# --- Generation -----------------------------------------------------------
CHAT_MODEL = os.environ.get("MYRI_CHAT_MODEL", "gemini-3.1-flash-lite")
# Prepend the Anthropic-style safety/grounding/tone layer (backend/claude_style.py)
# to every bot's system prompt. Set false once on a model that already behaves this way.
STYLE_LAYER_ENABLED = _bool("MYRI_STYLE_LAYER", True)
CHAT_MAX_OUTPUT_TOKENS = _int("MYRI_CHAT_MAX_OUTPUT_TOKENS", 1200)
CHAT_TEMPERATURE = _float("MYRI_CHAT_TEMPERATURE", 0.7)
# Trim conversation history sent upstream to the last N turns (user+model pairs).
CHAT_HISTORY_MAX_MESSAGES = _int("MYRI_CHAT_HISTORY_MAX_MESSAGES", 24)

# --- Retrieval / RAG -----------------------------------------------------
CHROMA_PATH = os.environ.get("MYRI_CHROMA_PATH", "./chroma_db")
EMBED_MODEL = os.environ.get("MYRI_EMBED_MODEL", "models/gemini-embedding-001")
RAG_FETCH_K = _int("MYRI_RAG_FETCH_K", 20)          # candidates pulled from the vector store
RAG_TOP_K = _int("MYRI_RAG_TOP_K", 4)               # kept after reranking
RERANK_ENABLED = _bool("MYRI_RERANK_ENABLED", True)
RERANKER_MODEL = os.environ.get(
    "MYRI_RERANKER_MODEL", "cross-encoder/mmarco-mMiniLMv2-L12-H384-v1"
)
# Bump this string (or it derives from the chroma mtime) to invalidate the cache
# after a re-ingest.
CORPUS_VERSION = os.environ.get("MYRI_CORPUS_VERSION", "")

# --- Retrieval cache ----------------------------------------------------
RAG_CACHE_ENABLED = _bool("MYRI_RAG_CACHE_ENABLED", True)
RAG_CACHE_SEMANTIC = _bool("MYRI_RAG_CACHE_SEMANTIC", True)
RAG_CACHE_SEMANTIC_THRESHOLD = _float("MYRI_RAG_CACHE_SEMANTIC_THRESHOLD", 0.95)
RAG_CACHE_MAX_ROWS = _int("MYRI_RAG_CACHE_MAX_ROWS", 5000)

# --- Abuse control -----------------------------------------------------
# Per-client-IP limits on /chat (slowapi syntax).
RATE_LIMIT_CHAT = os.environ.get("MYRI_RATE_LIMIT_CHAT", "8/minute;40/hour;150/day")
# Hard daily ceilings across the whole deployment.
DAILY_REQUEST_CAP = _int("MYRI_DAILY_REQUEST_CAP", 4000)
DAILY_TOKEN_CAP = _int("MYRI_DAILY_TOKEN_CAP", 6_000_000)
# Per-identity (login email) daily request cap.
DAILY_REQUEST_CAP_PER_USER = _int("MYRI_DAILY_REQUEST_CAP_PER_USER", 120)
RESTING_MESSAGE = os.environ.get(
    "MYRI_RESTING_MESSAGE",
    "MYRI has answered a lot of questions today and is taking a short rest. "
    "Please come back tomorrow, in sha' Allah.",
)

# --- "Bring it to life" kid illustrations (guardians-club) -------------
# Runtime image generation, so it is off unless explicitly enabled and needs a
# billing-enabled key. Kept on a tight leash: a slowapi rate limit AND separate
# daily caps (per login and site-wide) so image spend can never run away.
KID_ART_ENABLED = _bool("MYRI_KID_ART_ENABLED", True)
KID_ART_MODEL = os.environ.get("MYRI_KID_ART_MODEL", "gemini-2.5-flash-image")
KID_ART_MAX_DESC_CHARS = _int("MYRI_KID_ART_MAX_DESC_CHARS", 400)
# Second-pass safety review of the *generated image itself* (not just the input
# prompt) before it reaches the child - see kid_art._moderate_or_raise. Cheap
# (one extra text-only-output call on the same flash-lite-class model), but a
# real backstop for when the image model doesn't follow SAFETY_RULES.
KID_ART_MODERATE_OUTPUT = _bool("MYRI_KID_ART_MODERATE_OUTPUT", True)
# Must be a currently-available model: gemini-2.5-flash-lite now 404s ("no longer
# available to new users"), which would make the fail-closed review reject every
# image. Kept in step with CHAT_MODEL's generation.
KID_ART_MODERATION_MODEL = os.environ.get("MYRI_KID_ART_MODERATION_MODEL", "gemini-3.1-flash-lite")
RATE_LIMIT_ILLUSTRATE = os.environ.get("MYRI_RATE_LIMIT_ILLUSTRATE", "3/hour;6/day")
KID_ART_DAILY_CAP = _int("MYRI_KID_ART_DAILY_CAP", 60)
KID_ART_DAILY_CAP_PER_USER = _int("MYRI_KID_ART_DAILY_CAP_PER_USER", 3)

# --- CORS -------------------------------------------------------------
# Comma-separated list of allowed origins. "*" (default when unset) is dev-only.
ALLOWED_ORIGINS = [
    o.strip() for o in os.environ.get("MYRI_ALLOWED_ORIGINS", "*").split(",") if o.strip()
]

# --- Cloudflare Turnstile -------------------------------------------
TURNSTILE_SECRET = os.environ.get("MYRI_TURNSTILE_SECRET", "")
TURNSTILE_ENABLED = bool(TURNSTILE_SECRET)
# HMAC secret used to sign the short-lived "human verified" token issued after
# a successful Turnstile check. Must be set in production if Turnstile is on.
SESSION_SIGNING_SECRET = os.environ.get("MYRI_SESSION_SIGNING_SECRET", "")
SESSION_TTL_SECONDS = _int("MYRI_SESSION_TTL_SECONDS", 86400)

DB_PATH = os.environ.get("MYRI_DB_PATH", "logs.db")

# --- Input size limits ---------------------------------------------------
# Defense-in-depth against oversized-payload cost/DoS abuse, applied before a
# request is even parsed for RAG/generation. Generous enough for a normal
# human chat turn, small enough to bound worst-case token spend per call.
CHAT_MESSAGE_MAX_CHARS = _int("MYRI_CHAT_MESSAGE_MAX_CHARS", 6000)
CHAT_MESSAGES_MAX_COUNT = _int("MYRI_CHAT_MESSAGES_MAX_COUNT", 80)
ILLUSTRATE_DESC_MAX_CHARS = _int("MYRI_ILLUSTRATE_DESC_MAX_CHARS", 1000)
LOG_MESSAGE_MAX_CHARS = _int("MYRI_LOG_MESSAGE_MAX_CHARS", 8000)
LOG_FIELD_MAX_CHARS = _int("MYRI_LOG_FIELD_MAX_CHARS", 200)
