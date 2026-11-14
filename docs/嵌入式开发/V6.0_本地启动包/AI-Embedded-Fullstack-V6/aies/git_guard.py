from __future__ import annotations

import subprocess
from pathlib import Path

from .errors import InputConflict
from .hashing import sha256_file


def snapshot_worktree(root: Path) -> dict:
    root = root.resolve(strict=True)
    result = subprocess.run(["git", "status", "--porcelain=v1", "-z"], cwd=root, capture_output=True, timeout=20, shell=False)
    if result.returncode != 0:
        return {"status": "UNAVAILABLE", "error": result.stderr.decode(errors="replace"), "dirty": []}
    entries = []
    for raw in result.stdout.split(b"\0"):
        if not raw:
            continue
        text = raw.decode("utf-8", errors="surrogateescape")
        code, relative = text[:2], text[3:]
        if " -> " in relative:
            relative = relative.split(" -> ", 1)[1]
        path = root / relative
        entries.append({"path": relative.replace("\\", "/"), "status": code, "sha256": sha256_file(path) if path.is_file() else None})
    return {"status": "VERIFIED", "dirty": entries}


def protect_dirty_overlap(snapshot: dict, intended_paths: list[str]) -> None:
    dirty = {item["path"].casefold() for item in snapshot.get("dirty", [])}
    overlap = sorted(path for path in intended_paths if path.replace("\\", "/").casefold() in dirty)
    if overlap:
        raise InputConflict(f"intended write overlaps pre-existing dirty files: {overlap}")
