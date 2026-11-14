from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timezone
from pathlib import Path

from .errors import AuthorizationRequired

READ_ONLY_ACTIONS = {"read", "search", "hash", "probe", "inspect", "route", "plan", "status", "verify"}
HIGH_RISK_ACTIONS = {
    "delete", "overwrite", "clean", "flash", "device_control", "git_add",
    "git_commit", "git_push", "fabrication_order", "production_release",
}


def canonical_claim(claim: dict) -> bytes:
    allowed = {key: claim[key] for key in ("action", "target", "expires_at", "nonce")}
    return json.dumps(allowed, sort_keys=True, separators=(",", ":")).encode("utf-8")


def sign_claim(claim: dict, key: bytes) -> str:
    return hmac.new(key, canonical_claim(claim), hashlib.sha256).hexdigest()


def verify_authorization(action: str, target: Path, artifact: dict | None, key: bytes | None) -> None:
    if action in READ_ONLY_ACTIONS:
        return
    if not artifact or not key:
        raise AuthorizationRequired(f"authorization artifact required for action: {action}")
    if artifact.get("action") != action or Path(artifact.get("target", "")).resolve(strict=False) != target.resolve(strict=False):
        raise AuthorizationRequired("authorization scope mismatch")
    try:
        expiry = datetime.fromisoformat(str(artifact["expires_at"]).replace("Z", "+00:00"))
    except (KeyError, ValueError) as exc:
        raise AuthorizationRequired("invalid authorization expiry") from exc
    if expiry.astimezone(timezone.utc) <= datetime.now(timezone.utc):
        raise AuthorizationRequired("authorization expired")
    supplied = str(artifact.get("signature", ""))
    if not hmac.compare_digest(supplied, sign_claim(artifact, key)):
        raise AuthorizationRequired("authorization signature invalid")
