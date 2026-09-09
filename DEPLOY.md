# Deploying MYRI cheaply

Target: **Oracle Cloud "Always Free" Ampere VM** (4 arm64 cores / 24 GB RAM, free
forever) behind **Cloudflare** (free plan) for TLS-at-the-edge, caching, bot
protection and Turnstile. Everything runs in one Docker container (FastAPI serves
both the API and the built frontend); Caddy does automatic HTTPS on the VM.

Running cost at low/medium traffic: **~$0/month** for infra. The only spend is
Gemini API usage (text generation + embeddings), which the daily budget in
`backend/.env` caps.

---

## 1. Create the VM

1. Oracle Cloud → Compute → Instances → **Create instance**.
2. Image: **Canonical Ubuntu 24.04**. Shape: **VM.Standard.A1.Flex**, 2–4 OCPU,
   12–24 GB (all within Always Free).
3. Add your SSH public key. Create.
4. **Networking → VCN → Security List** (or NSG): add **Ingress** rules allowing
   TCP **80** and **443** from `0.0.0.0/0`.

## 2. Point DNS

In Cloudflare (add your domain first, free plan):

- `A  myri.example.org  ->  <VM public IP>`  — Proxy **ON** (orange cloud).
- SSL/TLS mode: **Full (strict)**.

## 3. First boot

```bash
ssh ubuntu@<VM public IP>
git clone https://github.com/zahrazamani/myRI-bkfn.git
cd myRI-bkfn
bash deploy/setup-oracle.sh          # installs Docker, opens firewall, stops to let you edit .env
cp backend/.env.example backend/.env
nano backend/.env                    # see "Required settings" below
bash deploy/setup-oracle.sh          # run again -> builds and starts
```

### Required settings in `backend/.env`

| Key | Value |
|---|---|
| `GEMINI_API_KEY` | your Google AI Studio key |
| `MYRI_DOMAIN` | `myri.example.org` |
| `MYRI_ALLOWED_ORIGINS` | `https://myri.example.org` |
| `MYRI_ADMIN_TOKEN` | long random string (needed to read `/logs`) |
| `MYRI_SESSION_SIGNING_SECRET` | long random string |
| `MYRI_TURNSTILE_SECRET` | from Cloudflare → Turnstile (optional but recommended) |

And in `frontend/.env` before the build (the container build reads it):

```
VITE_API_BASE_URL=https://myri.example.org
VITE_TURNSTILE_SITE_KEY=<cloudflare turnstile site key>   # only if using Turnstile
```

## 4. Ingest the documents

The PDF corpus is committed to the repo under `backend/documents/{journey,compass,superhero}/`.
**Tafsir al-Mizan is not** — `backend/documents/noor/tafsir_almizan_en.db` (~29 MB)
is `.gitignore`d, so a fresh checkout won't have it. Copy it onto the box at
`backend/documents/noor/tafsir_almizan_en.db` before ingesting (or the
Journey / Noor / Guardians bots lose their tafsir grounding).

`backend/documents/README.md` lists every expected file. Then:

```bash
sudo docker compose --env-file backend/.env -f deploy/docker-compose.yml exec app python ingest.py
```

Re-run whenever the corpus changes, and bump `MYRI_CORPUS_VERSION` in `.env` so
the retrieval cache is invalidated, then `... up -d` to restart.

> **Rebuild is safe to run live.** `ingest.py` builds into `chroma_db.building`
> and atomically swaps it in at the end; the running server keeps serving the
> old store (held open) until you restart it. Embedding the full corpus
> (~43k chunks, Tafsir included) takes ~40 min and, on the free Gemini tier,
> hits rate limits — `ingest.py` retries with backoff, so just let it run.
> Restart the container afterwards to pick up the new store.

## 5. Updating later

```bash
cd myRI-bkfn && git pull
sudo docker compose --env-file backend/.env -f deploy/docker-compose.yml up -d --build
```

## Cloudflare hardening (free plan)

- **Turnstile**: create a widget, put the site key in `frontend/.env`, the secret
  in `backend/.env`. The login page then shows an "I am human" check and the
  backend refuses `/chat` without a valid token.
- **Bot Fight Mode**: Security → Bots → on.
- **Rate limiting rule**: e.g. `/chat` → 30 requests / 10 min / IP → Block.
- **Cache rule**: cache `/illustrations/*` and `/assets/*` aggressively.

## What throttles cost

| Layer | Setting | Where |
|---|---|---|
| Per-IP request rate | `MYRI_RATE_LIMIT_CHAT` | `backend/.env` |
| Whole-site daily requests | `MYRI_DAILY_REQUEST_CAP` | `backend/.env` |
| Whole-site daily tokens | `MYRI_DAILY_TOKEN_CAP` | `backend/.env` |
| Per-login daily requests | `MYRI_DAILY_REQUEST_CAP_PER_USER` | `backend/.env` |
| Model choice | `MYRI_CHAT_MODEL` | `backend/.env` |
| Retrieval cache | on by default | — |

When a cap is hit, `/chat` returns a friendly "MYRI is resting" message instead
of calling the model.
