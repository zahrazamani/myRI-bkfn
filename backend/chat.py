"""Server-side text generation (Gemini).

Moved off the browser so the API key never ships to clients and every call passes
through the rate limiter and daily budget. RAG context is retrieved and injected
here too, so the frontend only sends the conversation.
"""
from __future__ import annotations

import logging
import re

from google import genai
from google.genai import types

import claude_style
import config
import rag

log = logging.getLogger("myri.chat")

_client: genai.Client | None = None

# Bots whose replies should be grounded in retrieved documents.
RAG_BOTS = {
    "journey-beliefs", "superhero-universe", "daily-dialogue",
    "my-compass", "guardians-club", "better-me",
}

_GROUNDED_TEMPLATE = (
    "Use the following passages from MYRI's trusted Shia sources to answer. "
    "Rely only on them; if they do not contain the answer, say so plainly and do "
    "not invent details. Cite the source names you used.\n\n"
    "--- SOURCES ---\n{context}\n--- END SOURCES ---\n\n"
    "Question: {question}"
)
_NO_CONTEXT = (
    "MYRI's source library did not return a passage for this question. If you can "
    "answer from well-established, mainstream Shia teaching, do so in your normal "
    "style and voice, and make clear that this part is general knowledge rather "
    "than a retrieved source. If you cannot, say so plainly.\n\nQuestion: {question}"
)

# guardians-club.ts's own rule says the storyteller must never name a specific
# prophet - but red-team testing (see CHANGES-redteam-findings.md) showed the
# model doesn't reliably hold that line 100% of the time, especially when
# echoing a name straight out of a retrieved Tafsir al-Mizan passage. Prompt
# wording alone is a probabilistic defense; this is the deterministic backstop,
# scoped to the prophets who actually appear in the Guardians' Club's animal
# stories (a narrow list keeps false positives on unrelated English words low).
_PROPHET_NAME_RE = re.compile(
    r"\b(?:"
    r"yunus|jonah|dhu[\s-]?al[\s-]?nun|dhul[\s-]?nun"       # whale
    r"|sulayman|solomon"                                     # hoopoe / ant
    r"|salih"                                                # she-camel
    r"|musa|moses"                                           # cow / golden calf
    r"|uzayr|ezra"                                           # donkey of Uzayr
    r"|muhammad|mustafa"                                     # cave spider / cave dog
    r")\b",
    re.IGNORECASE,
)

# Perso-Arabic-script backstop for the Farsi experience. Persian text uses ZWNJ
# and glues clitics onto names, so \b is unreliable here; instead we match these
# specific religious names bare. Inside a Qur'anic-animal story the false-positive
# risk of these exact strings is negligible, and per the task safety beats
# fluency. Covers the prophets who appear in Guardians' Club animal stories.
#   یونس / یونُس, ذوالنون / ذو النون, سلیمان, صالح, موسیٰ / موسی,
#   عزیر / عُزَیر, محمد / محمّد, مصطفیٰ / مصطفی
# Optional Arabic diacritics (harakat U+064B-U+0652, superscript alef U+0670) and
# ZWNJ (U+200C) are tolerated between the base letters of each name.
_FA_MARKS = "[ً-ْٰ‌]*"
_FA_ALEF_MAKSURA = "[یيى]"  # ی / ي / ى - the final "-a" of موسی


def _fa_name(*letters: str) -> str:
    return _FA_MARKS.join(letters)


_PROPHET_NAME_FA_RE = re.compile(
    "(?:"
    + _fa_name("ی", "و", "ن", "س")                       # یونس / یونُس
    + "|" + "ذو" + _FA_MARKS + r"\s?" + "ال" + _FA_MARKS + "ن" + _FA_MARKS + "ون"  # ذوالنون / ذو النون
    + "|" + _fa_name("س", "ل", "ی", "م", "ا", "ن")       # سلیمان
    + "|" + _fa_name("ص", "ا", "ل", "ح")                 # صالح
    + "|" + "م" + _FA_MARKS + "و" + _FA_MARKS + "س" + _FA_MARKS + _FA_ALEF_MAKSURA + _FA_MARKS  # موسی / موسیٰ
    + "|" + _fa_name("ع", "ز", "ی", "ر")                 # عزیر / عُزَیر
    + "|" + _fa_name("م", "ح", "م", "د")                 # محمد / محمّد
    + "|" + "م" + _FA_MARKS + "ص" + _FA_MARKS + "ط" + _FA_MARKS + "ف" + _FA_MARKS + _FA_ALEF_MAKSURA + _FA_MARKS  # مصطفی / مصطفیٰ
    + ")"
)


def _redact_prophet_names(text: str, chatbot_id: str, language: str = "en") -> str:
    if chatbot_id != "guardians-club" or not text:
        return text
    replacement = "«آن پیامبر»" if language == "fa" else "the prophet"
    text = _PROPHET_NAME_RE.sub(replacement, text)
    text = _PROPHET_NAME_FA_RE.sub(replacement, text)
    return text


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        if not config.GOOGLE_API_KEY:
            raise RuntimeError("GOOGLE_API_KEY / GEMINI_API_KEY not set")
        _client = genai.Client(api_key=config.GOOGLE_API_KEY)
    return _client


def _to_contents(messages: list[dict]) -> list[types.Content]:
    out: list[types.Content] = []
    for m in messages:
        role = "model" if m.get("role") in ("model", "assistant", "bot") else "user"
        text = (m.get("text") or m.get("content") or "").strip()
        if text:
            out.append(types.Content(role=role, parts=[types.Part(text=text)]))
    return out


def generate_reply(
    chatbot_id: str,
    system_instruction: str,
    messages: list[dict],
    language: str = "en",
) -> dict:
    """messages: full conversation, oldest first, each {role, text}. Last is the new user turn.
    language: "en" (default) or "fa" - drives the Farsi behaviour directive and the
    language-aware prophet-name redaction. Any other value is treated as "en"."""
    if not messages:
        raise ValueError("no messages")
    language = "fa" if (language or "en").strip().lower() == "fa" else "en"

    history = messages[-config.CHAT_HISTORY_MAX_MESSAGES:]
    last_user = next((m for m in reversed(history) if (m.get("role") or "user") == "user"), None)
    sources: list[str] = []
    grounded = False

    if chatbot_id in RAG_BOTS and last_user:
        question = (last_user.get("text") or last_user.get("content") or "").strip()
        try:
            result = rag.retrieve_documents(question, chatbot_id)
        except Exception as exc:
            log.warning("retrieval failed for %s: %s", chatbot_id, exc)
            result = {"context": "", "sources": []}
        sources = result.get("sources", [])
        grounded = bool(result.get("context"))
        tmpl = _GROUNDED_TEMPLATE if grounded else _NO_CONTEXT
        wrapped = tmpl.format(context=result.get("context", ""), question=question)
        history = history[:-1] + [{"role": "user", "text": wrapped}]

    contents = _to_contents(history)
    cfg = types.GenerateContentConfig(
        system_instruction=claude_style.wrap(
            system_instruction, grounded=grounded, chatbot_id=chatbot_id,
            language=language,
        ) or None,
        max_output_tokens=config.CHAT_MAX_OUTPUT_TOKENS,
        temperature=config.CHAT_TEMPERATURE,
        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
    )
    resp = _get_client().models.generate_content(
        model=config.CHAT_MODEL, contents=contents, config=cfg
    )

    usage = getattr(resp, "usage_metadata", None)
    reply_text = _redact_prophet_names((resp.text or "").strip(), chatbot_id, language)
    return {
        "text": reply_text,
        "sources": sources,
        "input_tokens": getattr(usage, "prompt_token_count", 0) or 0,
        "output_tokens": getattr(usage, "candidates_token_count", 0) or 0,
    }
