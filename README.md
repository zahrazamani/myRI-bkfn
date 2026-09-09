# MyRI — My Real Intelligence

A set of Shia-sources-grounded chatbots for kids and teens. React frontend +
FastAPI backend with retrieval-augmented generation over a local vector store.

## Structure

- `frontend/` — React + Vite single-page app.
- `backend/` — FastAPI server: `/chat` (server-side Gemini calls + RAG), `/verify`
  (Cloudflare Turnstile), `/query` (raw retrieval), `/log` + `/logs`.
- `backend/generate_illustrations.py` — offline tool that builds the storybook
  images for *The Lost Guardians' Club* (see `backend/illustrations/README.md`).
- `deploy/` — one-container Docker stack + Oracle Cloud setup. See `DEPLOY.md`.

## How it works

1. The browser sends the conversation to the backend `POST /chat` — **no API key
   in the frontend**.
2. For grounded bots the backend embeds the question, checks a retrieval cache,
   searches Chroma, reranks locally, and injects the top passages.
3. The backend calls Gemini (`MYRI_CHAT_MODEL`, default `gemini-3.5-flash-lite`),
   records token usage against the daily budget, and returns `{ text, sources }`.
4. Rate limits (per-IP), a daily request/token ceiling, and optional Turnstile
   keep pro-bono costs bounded.

## Local development

### Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # set GEMINI_API_KEY
python ingest.py              # after putting files in backend/documents/
python main.py                # http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env          # VITE_API_BASE_URL=http://localhost:8000
npm run dev                   # http://localhost:3000
```

## Configuration

Everything is environment-driven — see `backend/.env.example` for the full list
(model, retrieval, rate limits, budget caps, CORS, Turnstile, admin token).

## Deployment

See `DEPLOY.md` — Oracle Cloud Always-Free VM + Cloudflare, ~$0/month infra.
