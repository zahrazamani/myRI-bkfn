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

The single-container deploy reads **only `backend/.env`** (`docker compose --env-file
backend/.env`) - both the backend runtime env and the frontend `VITE_*` build args
come from it. (`frontend/.env` is only for a local `npm run dev`.)

| Key | Value |
|---|---|
| `GEMINI_API_KEY` | your Google AI Studio key |
| `MYRI_DOMAIN` | `myri.example.org` |
| `MYRI_ALLOWED_ORIGINS` | `https://myri.example.org` |
| `MYRI_ADMIN_TOKEN` | long random string (needed to read `/logs`) |
| `MYRI_SESSION_SIGNING_SECRET` | long random string |
| `MYRI_TURNSTILE_SECRET` | from Cloudflare → Turnstile (optional but recommended) |
| `MYRI_GOOGLE_CLIENT_ID` | OAuth Web client ID, if using Google Sign-In (optional) |
| `VITE_API_BASE_URL` | `https://myri.example.org` (browser calls the API directly) |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile **site** key, if `MYRI_TURNSTILE_SECRET` is set |
| `VITE_GOOGLE_CLIENT_ID` | **same value** as `MYRI_GOOGLE_CLIENT_ID`, if using Google Sign-In |

`VITE_*` values are baked into the JS bundle at image-build time, so changing one
needs `docker compose ... up -d --build`, not just a restart.

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

## Google Sign-In (optional, S4)

Without this, "login" is an unverified email string and per-user daily caps can be
bypassed by typing a new email. Google Sign-In makes the identity real.

1. **Google Cloud Console** → create/select a project.
2. **APIs & Services → OAuth consent screen**: User type *External*; fill app name,
   support email, developer email. Scopes: leave the defaults (`openid`, `email`,
   `profile`) — no Google verification review is needed for these. Add yourself
   under *Test users* to try it, then **Publish app** to let anyone sign in.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   Application type **Web application**. Under *Authorized JavaScript origins* add
   every origin the app is served from, scheme + host + port, no path:
   - `https://myri.example.org`
   - `http://localhost:3000` and `http://localhost:8000` for local testing
   *Authorized redirect URIs* — leave empty (the button flow doesn't use them).
4. Copy the **Client ID** (`…apps.googleusercontent.com`). No client secret needed.
5. In `backend/.env` set **both**:
   ```
   MYRI_GOOGLE_CLIENT_ID=…apps.googleusercontent.com
   VITE_GOOGLE_CLIENT_ID=…apps.googleusercontent.com
   ```
6. Rebuild: `docker compose --env-file backend/.env -f deploy/docker-compose.yml up -d --build`
   (the client ID is baked into the JS bundle, so a plain restart won't pick it up).

The login page then shows "Sign in with Google" above the email form. The backend
verifies the ID token and per-user caps key off the verified Google account id.
Common failure: an origin mismatch — `http://localhost` vs `http://127.0.0.1`, or
a missing port, counts as a different origin in the console.

## Cloudflare hardening (free plan)

- **Turnstile**: create a widget, put `VITE_TURNSTILE_SITE_KEY` and
  `MYRI_TURNSTILE_SECRET` in `backend/.env`, rebuild. The login page then shows an
  "I am human" check and the backend refuses `/chat` without a valid token.
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
