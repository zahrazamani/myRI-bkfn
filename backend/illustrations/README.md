# Story illustrations — The Lost Guardians' Club

The storyteller bot picks from a fixed library of pre-generated illustrations
with `[show_image: <id>]` (no runtime generation for the story itself).

- **12 stories × 10 scenes**, each scene can have several **variants**
- Art-direction prompts: `prompts.json`
- Generator: `../generate_illustrations.py` (model: `gemini-2.5-flash-image`,
  a.k.a. "Nano Banana", using `_style_ref.png` so every scene matches)
- Output: `../../frontend/public/illustrations/<story>/<NN>/<letter>.jpg`
  (one folder per scene, one file per variant: `a.jpg`, `b.jpg`, …), served at
  `/illustrations/<story>/<NN>/<letter>.jpg`
- Variant manifest (auto-written on every run):
  - `../../frontend/data/illustration-variants.ts` — bundled into the app
  - `../../frontend/public/illustrations/manifest.json` — for the review page
- Frontend catalog (ids + captions the bot sees): `../../frontend/data/illustrations.ts`
- The app shows one variant per **story session** (a re-read looks different);
  scenes with no file yet are simply skipped.

## Generating (incrementally, "as we go along")

Image generation needs **billing enabled** on the Google project that owns
`GEMINI_API_KEY` (the free tier disallows it). ~US$0.04 per image.

```bash
cd backend
./venv/bin/pip install -r requirements-dev.txt

./venv/bin/python generate_illustrations.py --list                      # status (shows variant letters)
./venv/bin/python generate_illustrations.py --style-ref                 # make the style anchor once
./venv/bin/python generate_illustrations.py --story donkey --start 7 --count 4   # fill the gaps
./venv/bin/python generate_illustrations.py --story ant --variants 3    # bring ant up to 3 variants each
./venv/bin/python generate_illustrations.py --only cave-spider-04 --overwrite    # redo one
./venv/bin/python generate_illustrations.py --write-manifest            # just rebuild the manifest
```

Existing variant files are skipped, so it is safe to stop and resume. Every run
that touches files also rewrites the manifest. **Commit the new `.jpg` files, the
regenerated `illustration-variants.ts` and `manifest.json` together.**

## Reviewing

`npm run dev` in `frontend/`, then open `/illustrations-review.html` — it reads
`manifest.json` and shows every scene with all its variants side by side.

## Content rules (baked into every prompt)

- No depiction of prophets, the Prophet Muhammad, imams, angels, or any
  identifiable holy figure — people appear only as distant silhouettes / from
  behind / implied.
- No text in the image, no modern objects, no violence or gore.
- One consistent warm painterly storybook style for ages 10–15.

## "Bring it to life" (the one runtime exception)

After a story, the child can describe their own scene and get a single
illustration in that story's style. That path is `backend/kid_art.py` +
`POST /illustrate`, gated by a slowapi rate limit and the daily caps in
`usage.check_illustrate`. The same content rules above are applied to every
call regardless of what the child types; the result is returned once and never
written to disk. Turn it off with `MYRI_KID_ART_ENABLED=false`.
