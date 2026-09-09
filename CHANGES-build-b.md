# MYRI — cost-reduction rebuild (Build B + illustrations)

Status of the work you asked for: drop runtime Imagen → pre-generated
illustrations, then Build B (server-side generation, reranking, retrieval cache,
rate limits + budget, Turnstile, cheap deploy).

---

## Your current stack (what I found)

| Layer | Before |
|---|---|
| Generation | `gemini-2.5-flash` called **from the browser**; API key compiled into the JS bundle |
| Images | `imagen-4.0-generate-001` per story (~$0.04 each) |
| RAG backend | FastAPI, retrieval only, top-4 pure vector, no rerank |
| Vector store | Chroma (local), `gemini-embedding-001` — **currently empty, needs ingest** |
| Grounding | only `journey-beliefs` wired; other bots answer ungrounded |
| Abuse control | none — CORS `*`, no rate limit, `/logs` world-readable |
| Hosting | single FastAPI process, no deploy config in repo |

**Where the money was going:** (1) the exposed key in the bundle — anyone could
lift it and run their own traffic on your bill; (2) Imagen; (3) `gemini-2.5-flash`
with full history + long prompts re-sent every turn.

---

## What's built and tested

### Illustrations (runtime Imagen removed)
- `backend/illustrations/prompts.json` — **6 stories × 10 art-directed scenes** (Cave Spider, Cave Dog, Hoopoe, Raven, Elephant, Ant), all figure-safe (no prophets/holy figures — silhouettes/implied only), one consistent storybook style.
- `backend/generate_illustrations.py` — batched generator (`--story`, `--only`, `--start/--count`, `--all`, `--overwrite`), skips existing files, uses `gemini-2.5-flash-image` ("Nano Banana") + a locked style reference. Tested end-to-end except the actual API call (see blocker 1).
- `frontend/data/illustrations.ts` — catalog the bot sees.
- `frontend/chatbots/guardians-club.ts` — prompt now says *never generate*, pick from the catalog with `[show_image: <id>]`.
- `frontend/components/ChatModal.tsx` — renders those, falls back to `_placeholder.svg` until real files land.
- `frontend/services/geminiService.ts` — `generateImage()` deleted.

### Build B — backend (`backend/`)
- `config.py` — everything env-driven (`.env.example` has the full list).
- `chat.py` + `/chat` endpoint — **generation moved server-side**. Model default `gemini-3.5-flash-lite` (`MYRI_CHAT_MODEL`). Does RAG retrieval + grounding server-side; returns `{text, sources}`. Implicit prompt caching. History trimmed to last 24 msgs.
- `reranker.py` — local multilingual cross-encoder (`cross-encoder/mmarco-mMiniLMv2-L12-H384-v1`), retrieve 20 → rerank → keep 4. Degrades to vector-order if the model can't load. **Tested.**
- `rag_cache.py` — SQLite retrieval cache, exact + semantic (cosine ≥ 0.95 on the query embedding we already compute). Auto-invalidates on re-ingest (chroma mtime or `MYRI_CORPUS_VERSION`).
- `usage.py` — daily request + token ceilings and a per-login cap; over budget → friendly "MYRI is resting" 429. **Tested.**
- `security.py` — Cloudflare Turnstile verify + HMAC-signed short-lived "human" token; `require_human` dependency on `/chat` (no-op when Turnstile unset).
- `main.py` — slowapi per-IP limits (`8/min;40/hr;150/day` on `/chat`, **tested**), CORS locked to `MYRI_ALLOWED_ORIGINS`, `/logs` now behind `MYRI_ADMIN_TOKEN` (**tested → 403 without it**).

### Build B — frontend
- `geminiService.ts` — rewritten to call `/chat`; no API key client-side. `RestingError` shown to the user verbatim.
- `LoginPage.tsx` — optional Turnstile widget (only if `VITE_TURNSTILE_SITE_KEY` set).
- `vite.config.ts` — **API-key injection removed**. Verified the built bundle contains no key.
- Builds clean, typechecks clean.

### Deploy (`deploy/` + `DEPLOY.md`)
- One Docker image (multi-stage: builds frontend, runs FastAPI), `docker-compose.yml` with **Caddy** for automatic HTTPS, `setup-oracle.sh` for an **Oracle Cloud Always-Free arm64 VM**. Infra cost ≈ **$0/month**.

---

## Blockers that need you

### 1. Image generation needs billing enabled  🔴
Your `GEMINI_API_KEY` is **free-tier**. Text generation and embeddings work on it
(with rate limits), but image models are hard-blocked (`free_tier ... limit: 0`).
The frontend key in `frontend/.env` is **invalid** (rejected by Google).

To generate the 60 illustrations (~$2.50 total, one-time):
enable pay-as-you-go on the Google Cloud project behind the key
(aistudio.google.com → your key → associate a billing-enabled project), put that
key in `backend/.env`, then tell me and I'll run the batches. The app already
works with placeholders until then.

### 2. Vector store is empty + Tafsir DB missing  🟠
`backend/chroma_db` has 0 vectors and `backend/documents/tafsir_almizan_en.db`
isn't present. RAG answers will say "not in the sources" until you:
- add `tafsir_almizan_en.db` to `backend/documents/`
- run `python ingest.py` (your in-progress batching/retry edit handles the
  free-tier rate limits)

### 3. Model names moved on (FYI, already handled)
It's Sept 2026 — `gemini-2.0-flash` and `gemini-2.5-flash-lite` are retired for
new use. Defaults are now `gemini-3.5-flash-lite` (chat) and `gemini-embedding-001`.
Override via `MYRI_CHAT_MODEL` / `MYRI_EMBED_MODEL` any time.

---

## Try it locally

```bash
# backend
cd backend && ./venv/bin/pip install -r requirements.txt
cp .env.example .env          # paste GEMINI_API_KEY
./venv/bin/python main.py

# frontend (new terminal)
cd frontend && npm install
echo "VITE_API_BASE_URL=http://localhost:8000" > .env
npm run dev
```

Non-grounded bots (Better Me, Guardians' Club storytelling) work now. Grounded
answers need the ingest (blocker 2).

---

## Cost after this

| Item | Before | After |
|---|---|---|
| Exposed key abuse | unbounded | **eliminated** (key server-side only) |
| Image per story view | ~$0.04 | **$0** (pre-generated, served static) |
| Text answer | ~$0.01–0.02 (`2.5-flash`, full history) | ~$0.0005–0.001 (`3.5-flash-lite`, trimmed, cached, cache-hits free) |
| Vector DB / host | whatever you're paying | **$0** (Oracle free VM + Chroma file) |
| Runaway traffic | possible | capped by rate limit + daily budget → "resting" message |

Nothing is committed — all changes are in your working tree for review.
