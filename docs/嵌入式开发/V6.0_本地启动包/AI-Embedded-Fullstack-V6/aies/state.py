from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from .errors import ContractError, InputConflict
from .hashing import sha256_file

TRANSITIONS = {
    "DISCOVERING": {"BASELINED", "BLOCKED", "FAILED", "CANCELLED"},
    "BASELINED": {"PLANNED", "NEEDS_REVIEW", "CANCELLED"},
    "PLANNED": {"AUTHORIZED", "BLOCKED", "CANCELLED"},
    "AUTHORIZED": {"EXECUTING", "NEEDS_REVIEW", "CANCELLED"},
    "EXECUTING": {"VERIFYING", "PARTIAL", "FAILED", "NEEDS_REVIEW", "CANCELLED"},
    "VERIFYING": {"COMPLETED", "PARTIAL", "BLOCKED", "FAILED", "NEEDS_REVIEW"},
    "RESUMING": {"BASELINED", "PLANNED", "AUTHORIZED", "NEEDS_REVIEW", "BLOCKED"},
}
TERMINAL = {"COMPLETED", "PARTIAL", "BLOCKED", "FAILED", "NEEDS_REVIEW", "CANCELLED"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def transition(state: dict, target: str) -> dict:
    current = state.get("state")
    if target not in TRANSITIONS.get(current, set()):
        raise ContractError(f"invalid state transition: {current} -> {target}")
    result = dict(state)
    result["state"] = target
    result["updated_at"] = utc_now()
    return result


def append_journal(path: Path, event: dict) -> dict:
    path.parent.mkdir(parents=True, exist_ok=True)
    complete = {"event_id": event.get("event_id", str(uuid.uuid4())), "timestamp": utc_now(), **event}
    with path.open("a", encoding="utf-8", newline="\n") as stream:
        stream.write(json.dumps(complete, ensure_ascii=False, sort_keys=True) + "\n")
        stream.flush()
        os.fsync(stream.fileno())
    return complete


def create_input_lock(paths: list[Path], root: Path, package_version: str) -> dict:
    locked = []
    for path in paths:
        resolved = path.resolve(strict=True)
        locked.append({"path": resolved.relative_to(root.resolve(strict=True)).as_posix(), "sha256": sha256_file(resolved)})
    return {"schema_version": "1.0", "package_version": package_version, "root": str(root.resolve()), "files": locked}


def verify_input_lock(lock: dict, current_package_version: str) -> dict:
    errors: list[str] = []
    if lock.get("package_version") != current_package_version:
        errors.append("package version changed; explicit handoff migration required")
    root = Path(lock.get("root", ""))
    for item in lock.get("files", []):
        path = root / item.get("path", "")
        if not path.is_file():
            errors.append(f"locked input missing: {item.get('path')}")
        elif sha256_file(path) != item.get("sha256"):
            errors.append(f"locked input changed: {item.get('path')}")
    return {"valid": not errors, "state": "RESUMABLE" if not errors else "NEEDS_REVIEW", "errors": errors}


def claim_write_lock(lock_path: Path, task_id: str, target: str) -> None:
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps({"task_id": task_id, "target": target}, sort_keys=True)
    try:
        descriptor = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError as exc:
        existing = lock_path.read_text(encoding="utf-8")
        raise InputConflict(f"write target already owned: {existing}") from exc
    with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
        stream.write(payload)


def recovery_plan(events: list[dict]) -> dict:
    """Do not replay completed operations; uncertain non-idempotent work needs review."""
    completed = {event.get("operation_id") for event in events if event.get("result") == "COMPLETED"}
    uncertain = [event.get("operation_id") for event in events if event.get("result") in {"STARTED", "UNKNOWN"} and not event.get("idempotent", False)]
    retryable = [event.get("operation_id") for event in events if event.get("result") in {"FAILED", "STARTED"} and event.get("idempotent", False)]
    return {
        "skip_completed": sorted(item for item in completed if item),
        "retryable": sorted(item for item in retryable if item),
        "needs_review": sorted(item for item in uncertain if item),
        "state": "NEEDS_REVIEW" if uncertain else "RESUMABLE",
    }
