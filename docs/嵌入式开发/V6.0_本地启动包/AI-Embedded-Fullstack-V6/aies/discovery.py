from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Iterable

from .errors import InputConflict
from .hashing import sha256_file
from .models import Fact

CONSTRAINT_NAMES = ("AGENTS.md", "CLAUDE.md", "CONSTRAINTS.md")
BUILD_MARKERS = ("CMakeLists.txt", "Makefile", "meson.build", "platformio.ini", "west.yml")
EDA_SUFFIXES = {".kicad_sch", ".kicad_pcb", ".schdoc", ".pcbdoc", ".prjpcb"}
SOURCE_SUFFIXES = {".c", ".h", ".cpp", ".hpp", ".s", ".asm", ".ld"}
SKIP_DIRS = {".git", ".aies", "out", "node_modules", "__pycache__"}
MAX_SCAN_FILES = 20000


def require_project_root(value: str | os.PathLike[str]) -> Path:
    root = Path(value).expanduser().resolve(strict=False)
    if not root.exists() or not root.is_dir():
        raise InputConflict(f"project root does not exist or is not a directory: {root}")
    return root.resolve(strict=True)


def iter_files(root: Path, max_files: int = MAX_SCAN_FILES) -> Iterable[Path]:
    seen = 0
    for current, dirs, files in os.walk(root):
        dirs[:] = sorted(d for d in dirs if d.lower() not in SKIP_DIRS)
        for name in sorted(files):
            seen += 1
            if seen > max_files:
                raise InputConflict(f"scan limit exceeded ({max_files} files): {root}")
            yield Path(current, name)


def discover_constraint_files(root: Path) -> list[Path]:
    found: list[Path] = []
    for path in iter_files(root):
        rel_parts = path.relative_to(root).parts
        if path.name in CONSTRAINT_NAMES or rel_parts == (".ai", "PROJECT_PROFILE.md"):
            found.append(path)
    return found


def inspect_project(root_value: str | os.PathLike[str]) -> dict:
    root = require_project_root(root_value)
    facts: list[Fact] = []
    counts = {"source": 0, "eda": 0, "build": 0, "constraints": 0}
    samples: dict[str, list[str]] = {key: [] for key in counts}
    constraints = set(discover_constraint_files(root))
    for path in iter_files(root):
        rel = path.relative_to(root).as_posix()
        kind = None
        if path in constraints:
            kind = "constraints"
        elif path.name in BUILD_MARKERS or path.suffix.lower() in {".uvprojx", ".ewp"}:
            kind = "build"
        elif path.suffix.lower() in EDA_SUFFIXES:
            kind = "eda"
        elif path.suffix.lower() in SOURCE_SUFFIXES:
            kind = "source"
        if kind:
            counts[kind] += 1
            if len(samples[kind]) < 20:
                samples[kind].append(rel)
    mode = "PROJECT_EXISTING" if any(counts.values()) else "PROJECT_UNKNOWN"
    facts.append(Fact("project_mode", mode, "VERIFIED", str(root)).to_dict())
    for key, count in counts.items():
        facts.append(Fact(f"{key}_file_count", count, "VERIFIED", str(root)).to_dict())
    for path in constraints:
        facts.append(Fact(
            "constraint_file", path.relative_to(root).as_posix(), "VERIFIED",
            str(path), sha256_file(path), scope=path.parent.relative_to(root).as_posix() or ".",
        ).to_dict())
    return {
        "schema_version": "1.0", "root": str(root), "mode": mode,
        "counts": counts, "samples": samples, "facts": facts,
        "limits": {"max_scan_files": MAX_SCAN_FILES, "sample_paths_per_kind": 20},
    }


def write_inspection(inspection: dict, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(inspection, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def resolve_fact_candidates(candidates: list[Fact]) -> dict:
    """Resolve equal facts and preserve conflicts without choosing a guessed value."""
    grouped: dict[str, list[Fact]] = {}
    for fact in candidates:
        grouped.setdefault(fact.key, []).append(fact)
    resolved: list[dict] = []
    conflicts: list[dict] = []
    for key, facts in grouped.items():
        values = {json.dumps(f.value, ensure_ascii=False, sort_keys=True) for f in facts}
        if len(values) == 1:
            resolved.append(facts[0].to_dict())
        else:
            conflicts.append({
                "key": key, "status": "CONFLICT",
                "candidates": [f.to_dict() for f in facts],
                "blocked_actions": ["write", "build_for_target", "device_action"],
                "allowed_actions": ["read", "inspect", "report"],
            })
    return {"resolved": resolved, "conflicts": conflicts, "valid_for_write": not conflicts}
