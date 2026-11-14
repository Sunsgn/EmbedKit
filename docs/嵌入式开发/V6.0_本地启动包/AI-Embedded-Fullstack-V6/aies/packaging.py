from __future__ import annotations

import hashlib
import json
import zipfile
from pathlib import Path

from . import __version__

EXCLUDED_PARTS = {"__pycache__", ".git", ".aies", "out"}
EXCLUDED_SUFFIXES = {".pyc", ".pyo", ".exe", ".log"}
ZIP_TIME = (2026, 1, 1, 0, 0, 0)


def file_hash_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def package_files(root: Path) -> list[Path]:
    result = []
    for path in root.rglob("*"):
        rel = path.relative_to(root)
        if path.is_file() and not any(part in EXCLUDED_PARTS for part in rel.parts) and path.suffix.lower() not in EXCLUDED_SUFFIXES and rel.as_posix() != "manifest.json":
            result.append(path)
    return sorted(result, key=lambda p: p.relative_to(root).as_posix())


def build_manifest(root: Path) -> dict:
    files = []
    for path in package_files(root):
        data = path.read_bytes()
        files.append({"path": path.relative_to(root).as_posix(), "size": len(data), "sha256": file_hash_bytes(data)})
    return {"schema_version": "1.0", "product": "AI Embedded Fullstack Engineering System", "version": __version__, "files": files}


def create_package(root: Path, output: Path) -> dict:
    root = root.resolve(strict=True)
    output.parent.mkdir(parents=True, exist_ok=True)
    manifest = build_manifest(root)
    manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        entries = [("manifest.json", manifest_bytes)] + [(path.relative_to(root).as_posix(), path.read_bytes()) for path in package_files(root)]
        for name, data in sorted(entries):
            info = zipfile.ZipInfo(name, ZIP_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, data)
    return {"output": str(output), "sha256": file_hash_bytes(output.read_bytes()), "files": len(manifest["files"]), "version": __version__}


def validate_package(path: Path) -> dict:
    errors: list[str] = []
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)):
            errors.append("duplicate archive path")
        try:
            manifest = json.loads(archive.read("manifest.json"))
        except (KeyError, json.JSONDecodeError) as exc:
            return {"valid": False, "errors": [f"manifest invalid: {exc}"]}
        expected = {item["path"]: item for item in manifest.get("files", [])}
        actual = set(names) - {"manifest.json"}
        missing = set(expected) - actual
        extra = actual - set(expected)
        errors += [f"missing file: {name}" for name in sorted(missing)]
        errors += [f"unmanifested file: {name}" for name in sorted(extra)]
        for name in sorted(set(expected) & actual):
            data = archive.read(name)
            if len(data) != expected[name].get("size"):
                errors.append(f"size mismatch: {name}")
            if file_hash_bytes(data) != expected[name].get("sha256"):
                errors.append(f"hash mismatch: {name}")
    return {"valid": not errors, "errors": errors, "files": len(expected), "version": manifest.get("version")}
