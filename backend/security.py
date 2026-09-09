"""Abuse controls: Cloudflare Turnstile verification, a signed "human" token,
and the shared slowapi rate limiter.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import time

import httpx
from fastapi import Header, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

import config

log = logging.getLogger("myri.security")

# --- rate limiter -------------------------------------------------------
limiter = Limiter(key_func=get_remote_address, default_limits=[])

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


async def verify_turnstile(token: str, remote_ip: str | None) -> bool:
    if not config.TURNSTILE_ENABLED:
        return True
    if not token:
        return False
    data = {"secret": config.TURNSTILE_SECRET, "response": token}
    if remote_ip:
        data["remoteip"] = remote_ip
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(TURNSTILE_VERIFY_URL, data=data)
        return bool(resp.json().get("success"))
    except Exception as exc:
        log.warning("turnstile verify failed: %s", exc)
        return False


# --- signed session token --------------------------------------------
# Issued by /verify after a good Turnstile check; presented on /chat as
# `Authorization: Bearer <token>`. Stateless (HMAC), no DB.

def _secret() -> bytes:
    s = config.SESSION_SIGNING_SECRET or config.TURNSTILE_SECRET
    if not s:
        # Dev fallback; fine because Turnstile is also disabled in that case.
        s = "myri-dev-unsafe-secret"
    return s.encode("utf-8")


def issue_session_token(identity: str | None) -> str:
    payload = {"sub": identity or "anon", "exp": int(time.time()) + config.SESSION_TTL_SECONDS}
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=")
    sig = hmac.new(_secret(), body, hashlib.sha256).digest()
    return f"{body.decode()}.{base64.urlsafe_b64encode(sig).rstrip(b'=').decode()}"


def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def validate_session_token(token: str) -> dict | None:
    try:
        body, sig = token.split(".", 1)
        expected = hmac.new(_secret(), body.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(_b64d(sig), expected):
            return None
        payload = json.loads(_b64d(body))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


async def require_human(request: Request, authorization: str | None = Header(default=None)) -> dict:
    """FastAPI dependency: allow the request only if it carries a valid token
    (or if Turnstile is disabled, in which case everyone is let through)."""
    if not config.TURNSTILE_ENABLED:
        return {"sub": "anon"}
    token = ""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    payload = validate_session_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="human-verification-required")
    return payload
