# MYRI — My Real Intelligence

Six Shia-sources-grounded chatbots for Muslim children, teens and young adults.
React + Vite frontend, FastAPI backend, retrieval-augmented generation over a
local Chroma vector store, running on a low-cost Gemini model.

| Bot | Role | Grounded in |
|---|---|---|
| **My Compass** | practical fiqh for daily life | al-Sistani, *Islamic Laws* + *A Code of Practice for Muslims in the West* |
| **The Journey of Fundamental Beliefs** | Shia belief & worldview | fixed library + Tafsir al-Mizan |
| **Daily Dialogue with Noor** | one open question, Socratic, step by step | Tafsir al-Mizan |
| **The Lost Guardians' Club** | Qur'anic animal stories (ages 11–15) | Tafsir al-Mizan; pre-generated illustrations |
| **My Superhero Universe** | a virtues game (ages 11–15) | Naraqi, *Jami' al-Sa'adat* |
| **Better Me** | coaching on one character trait | Naraqi, *Jami' al-Sa'adat* |

## How it works

1. The browser sends the whole conversation to `POST /chat`. **No API key ships
   to the client** — the frontend only carries each bot's descriptive prompt.
2. The backend appends a server-owned safety/identity layer
   (`claude_style.py` + `bot_registry.py`) that a request body cannot strip.
3. For grounded bots it embeds the question, checks a retrieval cache, searches
   Chroma per-corpus, reranks locally (`cross-encoder/mmarco-mMiniLMv2`), and
   injects the top passages with citations.
4. It calls Gemini (`MYRI_CHAT_MODEL`, default `gemini-3.1-flash-lite`), records
   token usage, and returns `{ text, sources }`.
5. Per-IP rate limits, whole-site daily request/token ceilings, a per-login cap,
   and optional Cloudflare Turnstile keep pro-bono spend bounded. When a ceiling
   is hit `/chat` returns a friendly "resting" message instead of calling the model.

### Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | status, model, today's usage + cost estimate + cache hit rate (no auth, coarse ops numbers only) |
| POST | `/chat` | the six bots; human-verified when Turnstile is on |
| POST | `/verify` | exchange a Turnstile token for a short-lived session token |
| POST | `/illustrate` | "bring it to life" — one kid-described image; **off by default** (`MYRI_KID_ART_ENABLED`) |
| POST | `/log` | append a transcript row (human-verified) |
| GET/DELETE | `/logs` | admin only (`X-Admin-Token: $MYRI_ADMIN_TOKEN`) |

## Local development

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt          # + requirements-dev.txt for the image tool
cp .env.example .env                      # set GEMINI_API_KEY
# add source files under backend/documents/<bot-folder>/, then:
python ingest.py
python main.py                            # http://localhost:8000
```

The Tafsir al-Mizan SQLite DB is gitignored — see `backend/documents/README.md`
for where to place it.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env                      # VITE_API_BASE_URL=http://localhost:8000
npm run dev                               # http://localhost:3000
```

### Tests

```bash
cd backend
./venv/bin/python -m pytest tests/ -q \
  --ignore=tests/test_adversarial_live.py --ignore=tests/test_adversarial_multiturn.py
```

The two `test_adversarial_*` suites spend real API calls probing bot replies; the
rest are offline and deterministic (guardrail wiring, frontend/backend
identity-scope sync, input caps).

## Configuration

Everything is environment-driven — see `backend/.env.example` for the full list:
model + token prices, retrieval + rerank + cache, rate limits, daily budget caps,
kid-art caps, CORS, Turnstile, admin token, prompt version.

- **Prompt version** — `VITE_PROMPT_VERSION=v1` rolls every bot back to the
  pre-2026-09 prompts; unset (or `v2`) ships the reworked ones. Both are in the
  bundle for now (`frontend/chatbots/_version.ts`).
- **Illustrations** — `backend/generate_illustrations.py` builds the storybook
  images offline (needs a billing-enabled key). See `backend/illustrations/README.md`.

## Deployment

See `DEPLOY.md` — single Docker container (frontend built in, FastAPI serves it),
Caddy for automatic HTTPS, Oracle Cloud Always-Free VM + Cloudflare. ~$0/month
infra; model spend capped by the daily budget.

## Repo layout

```
frontend/            React + Vite SPA
  chatbots/          one file per bot (prompt, examples, v1/v2)
  services/          chat, hero profile, cross-bot profile, auth, logging
  public/            self-hosted images (bots/, bg.jpg, illustrations/)
backend/
  main.py            FastAPI app + routes
  chat.py            server-side Gemini call + RAG injection
  rag.py rag_cache.py reranker.py   retrieval pipeline
  claude_style.py bot_registry.py   server-owned safety/identity layer
  usage.py security.py              budgets, rate limiting, Turnstile
  kid_art.py         runtime "bring it to life" image path
  ingest.py generate_illustrations.py   offline build tools
  tests/            guardrail + sync + adversarial suites
deploy/              Dockerfile, compose, Caddyfile, Oracle setup
```
