from __future__ import annotations

import argparse
import csv
import hashlib
import json
import zipfile
from pathlib import Path

DOMAIN_TARGETS = {
    "00-": "OPS-EVID-001", "01-": "SYS-SAFE-001", "02-": "SW-EXEC-001",
    "03-": "HW-SCH-001", "04-": "INT-IFACE-001", "05-": "VER-TRACE-001",
    "06-": "MFG-TRACE-001", "07-": "SYS-SAFE-001", "08-": "DIR-SCOPE-001",
    "09-": "OPS-EVID-001", "10-": "OPS-EVID-001", "11-": "OPS-EVID-001",
    "12-": "OPS-EVID-001",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def target_for(owner: str) -> str:
    normalized = owner.replace("\\", "/")
    leaf = normalized.split("/", 1)[0]
    for prefix, target in DOMAIN_TARGETS.items():
        if leaf.startswith(prefix):
            return target
    return "OPS-EVID-001"


def generate(source: Path, output: Path) -> dict:
    with zipfile.ZipFile(source) as archive:
        index_name = next(name for name in archive.namelist() if name.endswith("新规则索引.json"))
        data = json.loads(archive.read(index_name).decode("utf-8"))
    rules = data.get("rules", [])
    output.parent.mkdir(parents=True, exist_ok=True)
    fields = ["source_file", "old_id", "old_title", "new_id", "semantic_status", "difference", "evidence"]
    with output.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for rule in rules:
            owner = str(rule.get("owner", "UNKNOWN"))
            writer.writerow({
                "source_file": owner,
                "old_id": rule.get("id", "UNKNOWN"),
                "old_title": rule.get("title", ""),
                "new_id": target_for(owner),
                "semantic_status": "MERGED_SEED",
                "difference": "V6 executable umbrella maps this legacy rule; detailed domain equivalence remains REVIEW until dedicated rule/test evidence exists.",
                "evidence": f"baseline_sha256={sha256(source)};index={index_name}",
            })
    return {"rules": len(rules), "output": str(output), "source_sha256": sha256(source), "index": index_name}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    print(json.dumps(generate(args.source, args.output), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
