# MYRI - single container: builds the frontend, serves it + the API from FastAPI.
# Works on x86_64 and arm64 (Oracle Ampere free tier).

# ---- stage 1: build the React frontend ----
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Vite bakes VITE_* into the JS bundle at build time. .dockerignore keeps .env
# files out of the build context, so these arrive as build args (fed from
# backend/.env by deploy/docker-compose.yml). All optional - empty = feature off.
ARG VITE_API_BASE_URL=""
ARG VITE_TURNSTILE_SITE_KEY=""
ARG VITE_GOOGLE_CLIENT_ID=""
ARG VITE_PROMPT_VERSION=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_PROMPT_VERSION=$VITE_PROMPT_VERSION
RUN npm run build

# ---- stage 2: python runtime ----
# 3.13 matches the interpreter requirements.txt was frozen against, so the
# pinned wheels resolve to exactly the same versions here.
FROM python:3.13-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/data/hf-cache \
    PORT=8000

WORKDIR /app/backend

# torch (a sentence-transformers dep) needs libgomp at runtime
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
# requirements.txt is a full freeze: every version is pinned, so this resolves
# to exactly one dependency set.
RUN pip install -r requirements.txt

COPY backend/ ./
# built frontend where main.py expects it (../frontend/dist)
COPY --from=frontend /app/frontend/dist /app/frontend/dist

# Persisted data (chroma_db, logs.db, HF model cache) lives on a mounted volume.
VOLUME ["/data"]
ENV MYRI_CHROMA_PATH=/data/chroma_db \
    MYRI_DB_PATH=/data/logs.db

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
    CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
