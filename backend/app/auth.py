from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _json_b64url(obj: dict[str, Any]) -> str:
    return _b64url(json.dumps(obj, separators=(",", ":"), sort_keys=True).encode("utf-8"))


def get_shared_secret() -> str:
    return os.getenv("BANK_AGENT_SHARED_SECRET", "dev-change-me-use-a-long-random-secret")


def get_token_ttl_seconds() -> int:
    raw = os.getenv("BANK_AUTH_TOKEN_TTL_SECONDS", "900")
    try:
        return max(60, int(raw))
    except ValueError:
        return 900


def hash_pin(phone: str, pin: str) -> str:
    """Demo-only PIN hash. Real banks never validate PIN like this from a chatbot service."""
    key = get_shared_secret().encode("utf-8")
    msg = f"{phone}:{pin}".encode("utf-8")
    return hmac.new(key, msg, hashlib.sha256).hexdigest()


def constant_time_equals(left: str, right: str) -> bool:
    return hmac.compare_digest(left.encode("utf-8"), right.encode("utf-8"))


def create_auth_token(phone: str, name: str) -> tuple[str, int]:
    issued_at = int(time.time())
    expires_at = issued_at + get_token_ttl_seconds()

    header = {"alg": "HS256", "typ": "BANK-AUTH"}
    payload = {
        "sub": phone,
        "name": name,
        "iat": issued_at,
        "exp": expires_at,
        "scope": "bank-card-safeguard",
        "verified": True,
    }
    signing_input = f"{_json_b64url(header)}.{_json_b64url(payload)}"
    signature = hmac.new(
        get_shared_secret().encode("utf-8"), signing_input.encode("utf-8"), hashlib.sha256
    ).digest()
    token = f"{signing_input}.{_b64url(signature)}"
    return token, get_token_ttl_seconds()
