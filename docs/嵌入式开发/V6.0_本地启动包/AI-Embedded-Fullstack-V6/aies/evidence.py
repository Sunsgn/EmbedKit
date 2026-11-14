from __future__ import annotations

from pathlib import Path

from .hashing import is_within, sha256_file

LEVELS = ("SCHEMA_VALID", "ARTIFACT_VERIFIED", "TOOL_VERIFIED", "INTEGRATION_VERIFIED", "APPROVAL_VERIFIED")
STATUSES = {"PASS", "FAIL", "BLOCKED", "NOT_RUN", "NOT_APPLICABLE"}


def verify_evidence(record: dict, evidence_root: Path) -> dict:
    errors: list[str] = []
    status = record.get("status")
    requested_level = record.get("level")
    if status not in STATUSES:
        errors.append("invalid status")
    if requested_level not in LEVELS:
        errors.append("invalid evidence level")
    paths = record.get("artifacts", [])
    verified: list[dict] = []
    if status == "PASS" and not paths:
        errors.append("PASS requires at least one evidence artifact")
    for item in paths:
        path = (evidence_root / item.get("path", "")).resolve(strict=False)
        if not is_within(path, evidence_root):
            errors.append(f"artifact outside evidence root: {path}")
            continue
        if not path.is_file():
            errors.append(f"artifact missing: {item.get('path')}")
            continue
        actual = sha256_file(path)
        if actual != item.get("sha256"):
            errors.append(f"artifact hash mismatch: {item.get('path')}")
        else:
            verified.append({"path": item.get("path"), "sha256": actual})
    if requested_level in {"TOOL_VERIFIED", "INTEGRATION_VERIFIED", "APPROVAL_VERIFIED"}:
        execution = record.get("execution", {})
        if execution.get("exit_code") != 0:
            errors.append("verified tool execution requires exit_code 0")
        expected = execution.get("expected_outputs", [])
        if not expected:
            errors.append("verified tool execution requires declared outputs")
        for rel in expected:
            if not (evidence_root / rel).is_file():
                errors.append(f"expected output missing: {rel}")
    if requested_level == "APPROVAL_VERIFIED" and not record.get("approval", {}).get("verified_by_external_system"):
        errors.append("self-asserted approval is not valid")
    return {"valid": not errors, "errors": errors, "verified_artifacts": verified, "level": requested_level}


def validate_completion_contract(task: dict, check_results: dict[str, dict]) -> dict:
    required = task.get("required_checks")
    if not required:
        return {"valid": False, "errors": ["completion contract has no required_checks"]}
    errors: list[str] = []
    for check in required:
        if not check.get("required", False):
            continue
        result = check_results.get(check.get("id"))
        if not result or result.get("status") != "PASS" or not result.get("evidence_valid"):
            errors.append(f"required check not verified: {check.get('id')}")
    return {"valid": not errors, "errors": errors}
