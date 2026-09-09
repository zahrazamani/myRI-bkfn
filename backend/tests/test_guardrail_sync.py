"""The identity/scope strings live in two places on purpose (see bot_registry.py):
once in frontend/chatbots/<bot>.ts inside the attacker-reachable systemInstruction,
and once in backend/bot_registry.py where a request cannot touch them. They are
meant to say the same thing. This test fails if they drift.

Fast, offline, no API key.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import bot_registry  # noqa: E402

CHATBOTS_DIR = Path(__file__).resolve().parents[2] / "frontend" / "chatbots"

# A TS double-quoted string body: any char except " or \, or an escaped pair.
_TS_STR = r'"((?:[^"\\]|\\.)*)"'
_GUARDRAIL_CALL = re.compile(
    r"securityGuardrails\(\{\s*"
    rf"identity:\s*{_TS_STR}\s*,\s*"
    rf"scope:\s*{_TS_STR}\s*,?\s*"
    r"\}\)",
    re.DOTALL,
)
_ID = re.compile(r"\bid:\s*'([a-z-]+)'")


def _unescape(s: str) -> str:
    return s.encode("utf-8").decode("unicode_escape") if "\\" not in s else re.sub(
        r"\\(.)", r"\1", s
    )


def _frontend_identity_scope() -> dict[str, tuple[str, str]]:
    out: dict[str, tuple[str, str]] = {}
    for ts in sorted(CHATBOTS_DIR.glob("*.ts")):
        if ts.name.startswith("_"):
            continue
        text = ts.read_text(encoding="utf-8")
        call = _GUARDRAIL_CALL.search(text)
        bot_id = _ID.search(text)
        if not call or not bot_id:
            continue
        out[bot_id.group(1)] = (_unescape(call.group(1)), _unescape(call.group(2)))
    return out


def test_every_backend_bot_has_a_frontend_guardrail_call():
    fe = _frontend_identity_scope()
    assert set(fe) == set(bot_registry.BOT_IDENTITY_SCOPE), (
        f"frontend bots {sorted(fe)} != backend {sorted(bot_registry.BOT_IDENTITY_SCOPE)}"
    )


@pytest.mark.parametrize("bot_id", sorted(bot_registry.BOT_IDENTITY_SCOPE))
def test_identity_and_scope_match_between_frontend_and_backend(bot_id):
    fe = _frontend_identity_scope()
    assert bot_id in fe, f"no securityGuardrails() call found in frontend/chatbots/{bot_id}.ts"
    assert fe[bot_id] == bot_registry.BOT_IDENTITY_SCOPE[bot_id], (
        f"\nfrontend: {fe[bot_id]}\nbackend:  {bot_registry.BOT_IDENTITY_SCOPE[bot_id]}"
    )
