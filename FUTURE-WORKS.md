# MYRI — Future Works

Backlog captured 2026-09-08. Split into (A) deferred slices of features being built
now, and (B) engagement/growth ideas not yet started. Nothing here is committed
work — it is a prioritised menu.

Related: `CHANGES-build-b.md`, `CHANGES-guardrails-security.md`,
`frontend/chatbots/_version.ts` (v1/v2 prompt toggle).

---

## 0. Prod-readiness pass (2026-09-10) — status

S1–S8 from the review are done in the working tree. Follow-ups they leave:

- **S4 (Google Sign-In):** code + deploy plumbing are in. To activate: create an
  OAuth 2.0 **Web** client in Google Cloud Console, add your origins to "Authorized
  JavaScript origins", set `MYRI_GOOGLE_CLIENT_ID` **and** `VITE_GOOGLE_CLIENT_ID`
  (same value) in `backend/.env`, `docker compose ... up -d --build`. Full steps in
  DEPLOY.md → "Google Sign-In". Until then the plain email login still shows.
- **Fixed in passing:** `VITE_*` env vars never reached the Docker frontend build
  (`.dockerignore` excludes `**/.env`, no build args existed) - so `VITE_API_BASE_URL`,
  `VITE_TURNSTILE_SITE_KEY` etc. were silently dropped in the containerised deploy.
  `deploy/Dockerfile` + `deploy/docker-compose.yml` now pass them as build args from
  `backend/.env`; `frontend/.env` is dev-only.
- **S5 (no LangChain):** `requirements.txt` had the `langchain*`/`langgraph*`/`langsmith`
  lines removed by hand; a few of their transitive-only deps may still be listed.
  Do a clean `pip install -r requirements.in && pip freeze > requirements.txt` on
  the next dependency change. No re-ingest was needed (embeddings match), but a
  re-ingest would still improve quality — some older chunks in the store have
  mangled whitespace and empty citations.
- **S8 (CI):** `.github/workflows/ci.yml` added. The `live-adversarial` job needs a
  `GEMINI_API_KEY` repo secret; it runs nightly on main and on PRs labelled
  `live-tests`.
- **Server-side profile / real accounts:** once S4 is live, move the localStorage
  profile (see A1) behind the Google identity so it survives devices.

---

## A. Deferred slices of the in-flight features

> Update 2026-09-08: the four in-flight features (unified profile, choose-your-path,
> voice-first, EN+FA) all landed in the working tree this pass. Items below are the
> pieces that were consciously deferred.

### A1. Unified profile (SHIPPED — `services/profile.ts`, `components/ProfileModal.tsx`, `ProfileStrip` in `ChatModal`)
- **Shareable profile / badge cards** — render a designed PNG of the Hero Card, a
  Guardian Badge, or "insight of the week" for sharing to a story or group chat.
  New `/card` endpoint reusing the `kid_art` / illustrate image pipeline. This is
  the main *organic growth* lever and should be the next thing after the profile
  itself lands.
- **"Continue where you left off"** for every bot — resume the last session's
  thread, not just Superhero's saved points. Transcripts already exist in
  `backend/logs.db`; needs a `/session/last` read path + a resume affordance in
  `ChatModal`.
- **Weekly goal + nudge** — "3 reflections this week" style target on the profile,
  with an opt-in reminder (see B7).
- **Profile-driven recommendations** — "people who worked on anger also explored
  the Cave of Anger" cross-links on the home grid.
- **Server-side profile** — profile currently lives in `localStorage` keyed by
  email. Move to a real per-user store so it survives device changes (ties into
  proper auth, see B9).

### A2. Choose-your-path stories (SHIPPED — `[choices: a | b]` command + buttons in `ChatModal`, prompt in `guardians-club.ts` `v2Extra`)
- **Bespoke art for branch beats** — branches currently reuse existing scene
  images or fall back to text. Generate new illustration sets per branch with
  `backend/generate_illustrations.py` + `backend/illustrations/prompts.json`.
- **Branching in the 19 non-illustrated animal stories** too, not just the 12
  illustrated ones.
- **Path-aware Guardian Badge** — badge text reflects which path the child chose.
- **"Replay a different way"** button at the end of a story.
- **Branching in the other bots** — the `[choices:]` parser is generic; only
  Guardians' Club emits it today. Superhero challenges could too.

### A3. Voice-first mode (SHIPPED this pass — `hooks/useVoiceConversation.ts`, `components/VoiceIndicator.tsx`)
- **Cloud TTS fallback** — `fa-IR` (and many `en` mobile) devices have no local
  speech-synthesis voice, so voice-over silently does nothing. Add a backend TTS
  call (budget-capped like `/illustrate`) used only when
  `speechSynthesis.getVoices()` has nothing usable for the locale.
- **Better STT** — Web Speech `SpeechRecognition` is Chrome/Android only; add a
  push-to-talk upload path to a backend transcription call for other browsers.
- **Read-along highlighting** — highlight each sentence as it is spoken (kids).
- **Wake-free turn-taking tuning** — silence-detection timeout, "still there?"
  re-prompts.

### A4. Multi-lingual EN + FA (SHIPPED — `i18n.ts`, backend `language` field + `_FARSI_EXTRA`, `_PROPHET_NAME_FA_RE`, RTL + Vazirmatn)
- **System prompts stay English.** The long `systemPrompt`s — including
  Guardians' Club's scripted per-animal hook sentences and the Superhero stage
  scripts — are NOT translated. The backend `_FARSI_EXTRA` directive tells the
  model to deliver those in Farsi at runtime, so Farsi quality depends on the
  model obeying it. If Farsi usage grows, maintain real Farsi prompt variants for
  `guardians-club` / `superhero-universe` (mirror the `_version.ts` pattern with a
  runtime `byLang`).
- **Perso-Arabic prophet-name redaction is deliberately greedy** — no word
  boundaries (Persian ZWNJ/clitics make `\b` unreliable), so it over-redacts rare
  words that embed a name (`موسیقی` "music", `مصالح`). Safe (over-redaction, not
  under), but ugly. Tighten later with a proper Persian-letter class that still
  excludes Persian punctuation (`؟ ، ؛` are in the same Unicode block as letters).
  See `_PROPHET_NAME_FA_RE` in `backend/chat.py`.
- **Farsi RAG corpora** — the Persian source PDFs were removed (`git log`);
  retrieval is English-only. Cross-lingual embedding (`gemini-embedding-001`)
  mostly works but the model must translate English passages into child Farsi
  every turn. Options, cheapest first:
  1. Translate the query to English before retrieval (one extra model call).
  2. Re-ingest Farsi editions of the source books, tagged by language, and prefer
     same-language passages.
- **Re-add Arabic** — dropped from the selector for now (EN + FA only). The
  `my-compass` prompt still handles typed Arabic. Re-add when there is capacity to
  localise the kids' experience for it too.
- **LoginPage language** is a separate local toggle (login renders before `App`
  state exists) and does not persist. Unify once there is a language context /
  stored preference.
- **Full UI localisation coverage** — audit every string after the first pass;
  date/number formatting; RTL polish on the Superhero `GameMap` and `HeroCard`.
- **Farsi voice** — depends on A3's cloud TTS.
- **Translated illustration captions / story keepsake** in Farsi.

---

## B. Engagement & growth ideas (not started)

### B1. Daily feed / short-form surface
A scrollable home surface that is *not* a chat: one Qur'an-animal fact, one virtue
micro-lesson, one "would you rather" ethical-dilemma card per day. Each card taps
through into the relevant bot. This is the main *first-visit conversion* lever —
teens don't open a chat app unprompted.

### B2. Streaks & daily check-in (partly covered by A1)
A visible streak counter and one pushed reflection question per day. Daily
Dialogue already asks for a daily habit; make the loop explicit. Highest-retention
pattern available.

### B3. Classroom / group mode
A youth-group leader or madrasa teacher creates a room; the group runs the same
bot journey; a shared *reflection* wall (not a points leaderboard). This is a
distribution channel — one leader brings 20+ kids. Needs: room creation, join
codes, a light moderation view, aggregate (non-identifying) reflection display.

### B4. Seasonal tracks
Time-boxed content: a Ramadan 30-day character challenge, a Muharram reflection
track. Drives daily return for a month at a time. Content + a track-progress UI
on the profile.

### B5. Quiz / "which virtue are you" funnels
Lightweight, shareable results that route into Better Me or Superhero. Pairs with
B1 and the shareable cards (A1).

### B6. Story keepsake export
A mini-comic PDF of a Guardians' Club story + the child's own "bring it to life"
drawing, to keep or print. Parents share these. Reuses story art + the kid
illustration already produced.

### B7. Opt-in reminders / notifications
"Your daily reflection with Noor is ready." Web push (PWA) first. Requires B2's
daily-question infrastructure.

### B8. Journaling feature
Turn the Better Me v2 "muraqaba journal" prompt into a real feature: saved daily
entries, a simple mood scale, a week-in-review the coach reads back. Private,
per-user.

### B9. Real auth + parent dashboard
Current auth is email-only, client-side (`authService.ts`). For the 11–15 group,
parents are the gatekeepers: a parent account, a gentle weekly summary of what
their child explored, visible safety controls. Unlocks server-side profiles (A1)
and reminders (B7).

### B10. Embeddable widget
A drop-in widget for mosque / school / youth-org websites that launches a chosen
bot. Low effort, high distribution.

### B11. Referral loop
"Invite a friend to the Club" tied to a shared badge unlock.

### B12. PWA / installable app + offline story reading
Wrap the existing SPA as a PWA; cache the illustrated stories for offline reading.

---

## Rough sequencing suggestion

1. Finish the 4 in-flight features + their A-list must-fixes (esp. A4 Farsi
   prophet-name redaction — safety).
2. Shareable cards (A1) — growth.
3. Daily feed + streaks (B1 + B2) — retention & conversion.
4. Classroom mode (B3) — distribution.
5. Seasonal track for the next Ramadan (B4).
6. Everything else as capacity allows.
