from __future__ import annotations

import argparse
import hashlib
import json
import zipfile
from pathlib import Path


REQUIRED_ROOT = {"AGENTS.md", "CLAUDE.md", "AI-INSTRUCTIONS.md", "README.md"}
REQUIRED_DOMAINS = {
    "core", "system", "software", "hardware", "pcb", "integration",
    "verification", "manufacturing", "security_release", "directory",
    "bringup_debug", "build_artifacts", "embedded_linux", "communication",
    "reliability", "mechanical_thermal", "extension",
    "power_energy", "bootloader_ota", "rf_wireless", "motor_control_power",
    "sensing_calibration", "compliance_certification", "field_maintenance",
    "supply_chain_lifecycle",
}
REQUIRED_WORKFLOWS = {
    "NEW_PROJECT_DISCOVERY", "SOFTWARE_CHANGE", "DRIVER_DEVELOPMENT",
    "PROTOCOL_CHANGE", "BOARD_BRINGUP", "SCHEMATIC_REVIEW", "PCB_CHANGE",
    "DEVICE_TEST", "DEFECT_FIX", "PROJECT_DELIVERY",
}
REQUIRED_TEMPLATES = {
    "PROJECT_PROFILE", "TASK_PLAN", "STATUS", "HANDOFF", "EVIDENCE", "INPUT_HASHES",
}
REQUIRED_PROJECT_CONSTRAINTS = {
    "software", "hardware_pcb", "verification_manufacturing",
    "security_release_field", "system_lifecycle",
}
FIXED_TIME = (2026, 1, 1, 0, 0, 0)


def _files(root: Path) -> list[Path]:
    return sorted(path for path in root.rglob("*") if path.is_file())


def validate_runtime(root: Path) -> dict:
    errors: list[str] = []
    if not root.is_dir():
        return {"valid": False, "errors": [f"runtime root missing: {root}"], "files": 0}
    files = _files(root)
    non_markdown = [path.relative_to(root).as_posix() for path in files if path.suffix.lower() != ".md"]
    if non_markdown:
        errors.append(f"non-Markdown files are forbidden: {non_markdown}")
    root_names = {path.name for path in files if path.parent == root}
    missing_root = sorted(REQUIRED_ROOT - root_names)
    if missing_root:
        errors.append(f"missing root entries: {missing_root}")
    profile = root / ".ai" / "PROJECT_PROFILE.md"
    project_index = root / ".ai" / "PROJECT_CONSTRAINTS.md"
    index = root / ".ai" / "constraints" / "INDEX.md"
    if not profile.is_file():
        errors.append("missing .ai/PROJECT_PROFILE.md")
    if not project_index.is_file():
        errors.append("missing .ai/PROJECT_CONSTRAINTS.md")
    if not index.is_file():
        errors.append("missing .ai/constraints/INDEX.md")
    domains = {path.stem for path in (root / ".ai" / "constraints").glob("*.md") if path.stem != "INDEX"}
    if domains != REQUIRED_DOMAINS:
        errors.append(f"domain mismatch: missing={sorted(REQUIRED_DOMAINS-domains)}, extra={sorted(domains-REQUIRED_DOMAINS)}")
    workflows = {path.stem for path in (root / ".ai" / "workflows").glob("*.md")}
    if workflows != REQUIRED_WORKFLOWS:
        errors.append(f"workflow mismatch: missing={sorted(REQUIRED_WORKFLOWS-workflows)}, extra={sorted(workflows-REQUIRED_WORKFLOWS)}")
    templates = {path.stem for path in (root / ".ai" / "templates").glob("*.md")}
    if templates != REQUIRED_TEMPLATES:
        errors.append(f"template mismatch: missing={sorted(REQUIRED_TEMPLATES-templates)}, extra={sorted(templates-REQUIRED_TEMPLATES)}")
    project_constraints = {path.stem for path in (root / ".ai" / "project_constraints").glob("*.md")}
    if project_constraints != REQUIRED_PROJECT_CONSTRAINTS:
        errors.append(
            "project constraint mismatch: "
            f"missing={sorted(REQUIRED_PROJECT_CONSTRAINTS-project_constraints)}, "
            f"extra={sorted(project_constraints-REQUIRED_PROJECT_CONSTRAINTS)}"
        )
    entry_text = (root / "AGENTS.md").read_text(encoding="utf-8") if (root / "AGENTS.md").is_file() else ""
    for required in ("PROJECT_PROFILE.md", "PROJECT_CONSTRAINTS.md", "project_constraints", "constraints/INDEX.md", "constraints/core.md", "不得预读全部专业约束", "状态、恢复与证据"):
        if required not in entry_text:
            errors.append(f"AGENTS.md missing required contract: {required}")
    if index.is_file():
        index_text = index.read_text(encoding="utf-8")
        for domain in REQUIRED_DOMAINS:
            if f"{domain}.md" not in index_text:
                errors.append(f"INDEX.md does not route domain: {domain}")
    return {
        "valid": not errors,
        "errors": errors,
        "files": len(files),
        "markdown_only": not non_markdown,
        "domains": len(domains),
        "workflows": len(workflows),
        "templates": len(templates),
        "project_constraints": len(project_constraints),
    }


def create_runtime_package(root: Path, output: Path) -> dict:
    validation = validate_runtime(root)
    if not validation["valid"]:
        raise ValueError("; ".join(validation["errors"]))
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in _files(root):
            info = zipfile.ZipInfo(path.relative_to(root).as_posix(), FIXED_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    return {"status": "PASS", "output": str(output), "sha256": digest, **validation}


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate and package the Markdown-only runtime constraints")
    parser.add_argument("--runtime-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = args.runtime_root.resolve(strict=True)
    output = args.output.resolve(strict=False)
    try:
        result = create_runtime_package(root, output)
    except (OSError, ValueError, UnicodeError) as exc:
        print(json.dumps({"status": "FAIL", "error": str(exc)}, ensure_ascii=False, indent=2))
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
