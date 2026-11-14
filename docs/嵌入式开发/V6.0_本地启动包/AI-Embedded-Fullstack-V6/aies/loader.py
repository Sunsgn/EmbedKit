from __future__ import annotations

import json
from pathlib import Path

from .hashing import sha256_file


class RuleLoader:
    def __init__(self, root: Path, previous_index: dict | None = None):
        self.root = root.resolve(strict=True)
        self.cache: dict[str, tuple[str, dict]] = {}
        self.previous_index = previous_index or {}
        self.metrics = {"disk_reads": 0, "cache_hits": 0, "revalidated": 0}

    def load(self, relative: str) -> dict:
        path = (self.root / relative).resolve(strict=True)
        path.relative_to(self.root)
        digest = sha256_file(path)
        cached = self.cache.get(relative)
        if cached and cached[0] == digest:
            self.metrics["cache_hits"] += 1
            return cached[1]
        if self.previous_index.get(relative) == digest:
            self.metrics["revalidated"] += 1
        data = json.loads(path.read_text(encoding="utf-8"))
        self.cache[relative] = (digest, data)
        self.metrics["disk_reads"] += 1
        return data

    def handoff_index(self) -> dict:
        return {relative: digest for relative, (digest, _data) in self.cache.items()}
