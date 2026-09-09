"""
Generate the pre-made story illustrations for The Lost Guardians' Club.

One-time / occasional build tool. NOT called at runtime by the app - the app only
serves the finished files from frontend/public/illustrations/.

Model: gemini-2.5-flash-image ("Nano Banana") via the Google GenAI API, using a
single locked style-reference image so all scenes look like one storybook.

Layout on disk (one folder per scene, one file per variant):

    frontend/public/illustrations/<story>/<NN>/<letter>.jpg
    e.g. frontend/public/illustrations/ant/03/a.jpg, ant/03/b.jpg

Every run also rewrites the variant manifest the frontend reads to pick one
variant per story session:

    frontend/data/illustration-variants.ts        (bundled into the app)
    frontend/public/illustrations/manifest.json   (for illustrations-review.html)

Setup:
    ./venv/bin/pip install -r requirements-dev.txt
    # needs GEMINI_API_KEY (or GOOGLE_API_KEY) in backend/.env, billing enabled

Examples:
    # see what's missing / what would run
    ./venv/bin/python generate_illustrations.py --list

    # make (or remake) the shared style reference
    ./venv/bin/python generate_illustrations.py --style-ref

    # add a second variant of every scene in one story
    ./venv/bin/python generate_illustrations.py --story ant --variants 2

    # generate a small batch (skips variants that already exist)
    ./venv/bin/python generate_illustrations.py --story ant --start 1 --count 3
    ./venv/bin/python generate_illustrations.py --only cave-spider-04,cave-spider-07

    # generate every missing FIRST variant, pausing between calls
    ./venv/bin/python generate_illustrations.py --all --sleep 6

    # just rewrite the manifest from what is already on disk
    ./venv/bin/python generate_illustrations.py --write-manifest

    # force overwrite of variant 'a'
    ./venv/bin/python generate_illustrations.py --story hoopoe --overwrite
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import string
import sys
import time
from pathlib import Path

import dotenv

BACKEND_DIR = Path(__file__).resolve().parent
PROMPTS_PATH = BACKEND_DIR / "illustrations" / "prompts.json"
ANIMALS_PATH = BACKEND_DIR / "illustrations" / "quran_animals.json"
STYLE_REF_PATH = BACKEND_DIR / "illustrations" / "_style_ref.png"
OUTPUT_ROOT = BACKEND_DIR.parent / "frontend" / "public" / "illustrations"
MANIFEST_BUNDLED = BACKEND_DIR.parent / "frontend" / "data" / "illustration-variants.ts"
MANIFEST_PUBLIC = OUTPUT_ROOT / "manifest.json"

MODEL = "gemini-2.5-flash-image"
# Rough public price per generated image, for the cost estimate only.
PRICE_PER_IMAGE_USD = 0.039
# Final on-disk size: long edge in px + JPEG quality. Keeps the repo small.
MAX_EDGE = 1024
JPEG_QUALITY = 82

dotenv.load_dotenv(BACKEND_DIR / ".env")


def _load_prompts() -> dict:
    with open(PROMPTS_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def _load_animals() -> dict:
    with open(ANIMALS_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def _forbidden_animals_in(text: str, animals: dict) -> list[str]:
    """Return non-Qur'anic animal words found in a scene's text, so we never
    spend an API call on a scene that sneaks in the wrong species."""
    allowed = set()
    for a in animals["allowed"]:
        allowed.add(a["id"])
        allowed.add(a["name"].lower())
        allowed.update(w.lower() for w in a.get("aliases", []))
    words = set(re.findall(r"[a-z]+", text.lower()))
    hits = sorted(w for w in words if w in animals["forbidden_examples"] and w not in allowed)
    return hits


def _client():
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        sys.exit("ERROR: set GEMINI_API_KEY or GOOGLE_API_KEY in backend/.env")
    from google import genai

    return genai.Client(api_key=api_key)


def _gen_config(text_and_image: bool = True):
    from google.genai import types

    kwargs = {"response_modalities": ["Text", "Image"] if text_and_image else ["Image"]}
    # aspect_ratio support varies by SDK version - add it only if available.
    if hasattr(types, "ImageConfig"):
        try:
            return types.GenerateContentConfig(
                image_config=types.ImageConfig(aspect_ratio="4:3"), **kwargs
            )
        except Exception:
            pass
    return types.GenerateContentConfig(**kwargs)


def _extract_image_bytes(response) -> bytes | None:
    for cand in getattr(response, "candidates", None) or []:
        content = getattr(cand, "content", None)
        for part in (getattr(content, "parts", None) or []):
            inline = getattr(part, "inline_data", None)
            if inline is not None and getattr(inline, "data", None):
                return inline.data
    return None


def _save_jpeg(raw: bytes, dest: Path) -> None:
    from PIL import Image

    img = Image.open(io.BytesIO(raw)).convert("RGB")
    w, h = img.size
    if max(w, h) > MAX_EDGE:
        scale = MAX_EDGE / max(w, h)
        img = img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "JPEG", quality=JPEG_QUALITY, optimize=True)


def _scene_dir(scene_id: str) -> Path:
    story, num = scene_id.rsplit("-", 1)
    return OUTPUT_ROOT / story / f"{int(num):02d}"


def _variant_dest(scene_id: str, letter: str) -> Path:
    return _scene_dir(scene_id) / f"{letter}.jpg"


def _existing_variants(scene_id: str) -> list[str]:
    d = _scene_dir(scene_id)
    if not d.is_dir():
        return []
    return sorted(p.stem for p in d.glob("*.jpg") if len(p.stem) == 1 and p.stem.isalpha())


def _variant_letters(count: int) -> list[str]:
    if count > len(string.ascii_lowercase):
        sys.exit(f"ERROR: --variants max is {len(string.ascii_lowercase)}")
    return list(string.ascii_lowercase[:count])


def write_manifest(data: dict) -> dict:
    """Scan OUTPUT_ROOT and rewrite both manifest copies. Returns {scene_id: [letters]}.

    - frontend/data/illustration-variants.ts : {scene_id: [letters]}, bundled into the app
    - frontend/public/illustrations/manifest.json : the same plus story/caption info,
      for illustrations-review.html
    """
    manifest: dict[str, list[str]] = {}
    review: dict[str, dict] = {"stories": []}
    for story_id, story in data["stories"].items():
        entry = {"id": story_id, "title": story["title"], "animal": story["animal"], "scenes": []}
        for i, scene in enumerate(story["scenes"], 1):
            letters = _existing_variants(scene["id"])
            if letters:
                manifest[scene["id"]] = letters
            entry["scenes"].append(
                {"id": scene["id"], "n": f"{i:02d}", "caption": scene["caption"], "variants": letters}
            )
        review["stories"].append(entry)

    manifest = dict(sorted(manifest.items()))
    body = json.dumps(manifest, indent=2)

    MANIFEST_PUBLIC.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PUBLIC.write_text(json.dumps(review, indent=2) + "\n", encoding="utf-8")

    ts = (
        "// AUTO-GENERATED by backend/generate_illustrations.py - do not edit by hand.\n"
        "// scene id -> the variant letters that exist on disk for it.\n"
        f"export const ILLUSTRATION_VARIANTS: Record<string, string[]> = {body};\n"
    )
    MANIFEST_BUNDLED.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_BUNDLED.write_text(ts, encoding="utf-8")
    return manifest


def ensure_style_ref(client, style: dict, force: bool = False) -> "object":
    from PIL import Image

    if STYLE_REF_PATH.exists() and not force:
        return Image.open(STYLE_REF_PATH)
    print("Generating shared style reference ...")
    resp = client.models.generate_content(
        model=MODEL, contents=[style["anchor_prompt"]], config=_gen_config()
    )
    raw = _extract_image_bytes(resp)
    if not raw:
        sys.exit("ERROR: style reference generation returned no image")
    STYLE_REF_PATH.parent.mkdir(parents=True, exist_ok=True)
    STYLE_REF_PATH.write_bytes(raw)
    print(f"  saved {STYLE_REF_PATH.relative_to(BACKEND_DIR.parent)}")
    return Image.open(io.BytesIO(raw))


def generate_variant(client, style_ref, style: dict, scene: dict, letter: str, overwrite: bool) -> str:
    dest = _variant_dest(scene["id"], letter)
    if dest.exists() and not overwrite:
        return "skip"
    full_prompt = (
        f"{style['base']}\n\n"
        f"SCENE: {scene['prompt']}\n\n"
        f"RULES: {style['rules']}\n\n"
        "Give this a fresh composition, camera angle and light from any other version "
        "of the same scene, while keeping the identical art style.\n\n"
        "Output a single finished 4:3 landscape illustration."
    )
    resp = client.models.generate_content(
        model=MODEL, contents=[style_ref, full_prompt], config=_gen_config()
    )
    raw = _extract_image_bytes(resp)
    if not raw:
        print(f"  !! {scene['id']} ({letter}): no image in response")
        return "fail"
    _save_jpeg(raw, dest)
    print(f"  ok {scene['id']} ({letter}) -> {dest.relative_to(BACKEND_DIR.parent)}")
    return "ok"


def _selected_scenes(data: dict, args) -> list[dict]:
    scenes: list[dict] = []
    for story_id, story in data["stories"].items():
        if args.story and story_id != args.story:
            continue
        scenes.extend(story["scenes"])
    if args.only:
        wanted = {s.strip() for s in args.only.split(",")}
        scenes = [s for s in scenes if s["id"] in wanted]
    if args.start is not None or args.count is not None:
        start = (args.start or 1) - 1
        end = start + args.count if args.count is not None else None

        def idx(s):
            return int(s["id"].rsplit("-", 1)[1])

        scenes = [s for s in scenes if idx(s) - 1 >= start and (end is None or idx(s) - 1 < end)]
    return scenes


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--story", help="limit to one story id (cave-spider, cave-dog, hoopoe, raven, elephant, ant, camel, cow, calf, fish, bee, donkey)")
    p.add_argument("--only", help="comma-separated scene ids, e.g. cave-spider-03,ant-09")
    p.add_argument("--start", type=int, help="first scene number within each story (1-10)")
    p.add_argument("--count", type=int, help="how many scene numbers from --start")
    p.add_argument("--all", action="store_true", help="generate every missing scene")
    p.add_argument("--variants", type=int, default=1,
                   help="how many variants (a, b, c ...) each selected scene should end up with (default 1)")
    p.add_argument("--overwrite", action="store_true", help="regenerate even if the variant file exists")
    p.add_argument("--style-ref", action="store_true", help="(re)generate the shared style reference and exit")
    p.add_argument("--list", action="store_true", help="show status of every scene and exit")
    p.add_argument("--write-manifest", action="store_true",
                   help="rewrite the variant manifest from what's on disk and exit")
    p.add_argument("--sleep", type=float, default=4.0, help="seconds to wait between API calls (default 4)")
    p.add_argument("--allow-any-animal", action="store_true",
                   help="skip the check that scene prompts only name Qur'anic animals")
    args = p.parse_args()

    data = _load_prompts()
    animals = _load_animals()

    if args.list:
        total = ready = variants_total = 0
        for story_id, story in data["stories"].items():
            print(f"\n{story_id}  ({story['title']})")
            for scene in story["scenes"]:
                total += 1
                letters = _existing_variants(scene["id"])
                ready += bool(letters)
                variants_total += len(letters)
                mark = ",".join(letters) if letters else " "
                print(f"  [{mark:<7}] {scene['id']:<18} {scene['caption']}")
        print(f"\n{ready}/{total} scenes have at least one variant; {variants_total} images total")
        return

    if args.write_manifest:
        manifest = write_manifest(data)
        print(f"wrote manifest: {len(manifest)} scenes, {sum(len(v) for v in manifest.values())} images")
        print(f"  {MANIFEST_BUNDLED.relative_to(BACKEND_DIR.parent)}")
        print(f"  {MANIFEST_PUBLIC.relative_to(BACKEND_DIR.parent)}")
        return

    if args.variants < 1:
        p.error("--variants must be >= 1")

    client = _client()

    if args.style_ref:
        ensure_style_ref(client, data["style"], force=True)
        return

    if not (args.story or args.only or args.all):
        p.error("choose a selection: --story / --only / --all (or --list / --write-manifest)")

    scenes = _selected_scenes(data, args)
    letters = _variant_letters(args.variants)

    # Expand to (scene, letter) jobs, skipping variants that already exist.
    jobs: list[tuple[dict, str]] = []
    for scene in scenes:
        for letter in letters:
            if args.overwrite or not _variant_dest(scene["id"], letter).exists():
                jobs.append((scene, letter))

    if not jobs:
        print("Nothing to do - every selected variant already exists (use --overwrite to redo).")
        write_manifest(data)
        return

    if not args.allow_any_animal:
        offenders = []
        seen = set()
        for scene, _ in jobs:
            if scene["id"] in seen:
                continue
            seen.add(scene["id"])
            hits = _forbidden_animals_in(f"{scene.get('caption', '')} {scene.get('prompt', '')}", animals)
            if hits:
                offenders.append((scene["id"], hits))
        if offenders:
            print("ERROR: these scenes name animals the Qur'an does not (pass --allow-any-animal to override):")
            for sid, hits in offenders:
                print(f"  {sid}: {', '.join(hits)}")
            sys.exit(1)

    print(f"About to generate {len(jobs)} image(s) with {MODEL}")
    print(f"Estimated cost: ~${len(jobs) * PRICE_PER_IMAGE_USD:.2f}")
    print("  " + ", ".join(f"{s['id']}({l})" for s, l in jobs))
    style_ref = ensure_style_ref(client, data["style"])

    results = {"ok": 0, "fail": 0, "skip": 0}
    for i, (scene, letter) in enumerate(jobs):
        try:
            outcome = generate_variant(client, style_ref, data["style"], scene, letter, args.overwrite)
        except Exception as exc:  # keep going through a batch
            print(f"  !! {scene['id']} ({letter}): {type(exc).__name__}: {exc}")
            outcome = "fail"
        results[outcome] = results.get(outcome, 0) + 1
        if i < len(jobs) - 1:
            time.sleep(args.sleep)

    manifest = write_manifest(data)
    print(f"\nDone: {results['ok']} ok, {results['fail']} failed, {results['skip']} skipped")
    print(f"Manifest: {len(manifest)} scenes, {sum(len(v) for v in manifest.values())} images")
    if results["fail"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
