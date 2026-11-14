from __future__ import annotations


def validate_interface_mapping(records: list[dict]) -> dict:
    errors: list[str] = []
    seen_pins: dict[str, str] = {}
    for index, record in enumerate(records):
        name = record.get("signal")
        pin = record.get("hardware_pin")
        driver = record.get("software_driver")
        if not name or not pin or not driver:
            errors.append(f"record {index} lacks signal/hardware_pin/software_driver")
            continue
        previous = seen_pins.get(pin)
        if previous and previous != name:
            errors.append(f"pin conflict: {pin} maps both {previous} and {name}")
        seen_pins[pin] = name
        if record.get("voltage_v") is None or record.get("direction") not in {"input", "output", "bidirectional", "analog"}:
            errors.append(f"signal {name} lacks verified voltage or direction")
    return {"status": "PASS" if not errors else "FAIL", "errors": errors, "checked": len(records)}


def evaluate_error_budget(contributors: list[dict], limit: float | None, unit: str | None) -> dict:
    missing = [item.get("name", "unnamed") for item in contributors if item.get("worst_case") is None or item.get("unit") != unit]
    if limit is None or not unit or missing:
        return {"status": "UNKNOWN", "missing": missing + (["limit/unit"] if limit is None or not unit else []), "total_worst_case": None}
    total = sum(abs(float(item["worst_case"])) for item in contributors)
    return {"status": "PASS" if total <= limit else "FAIL", "total_worst_case": total, "limit": limit, "unit": unit, "method": "arithmetic worst-case sum"}


def check_version_compatibility(matrix: list[dict], hardware: str, firmware: str, calibration: str) -> dict:
    for row in matrix:
        if row.get("hardware") == hardware and row.get("firmware") == firmware and row.get("calibration") == calibration:
            approved = row.get("status") == "VERIFIED_COMPATIBLE"
            return {"status": "PASS" if approved else "BLOCKED", "matched": row, "reason": "verified combination" if approved else "combination is not verified compatible"}
    return {"status": "BLOCKED", "matched": None, "reason": "combination absent from compatibility matrix"}


def validate_nvm_migration(contract: dict) -> dict:
    required = ("from_version", "to_version", "length", "checksum", "migration", "rollback")
    missing = [key for key in required if not contract.get(key)]
    if contract.get("from_version") == contract.get("to_version"):
        missing.append("distinct source and target versions")
    return {"status": "PASS" if not missing else "FAIL", "missing": missing}


def validate_safety_contract(contract: dict) -> dict:
    required = ("hazard", "safe_state", "timing_limit_ms", "fault_injection", "evidence_required")
    missing = [key for key in required if contract.get(key) in (None, "", [])]
    return {"status": "PASS" if not missing else "NOT_RUN", "missing": missing, "approval": "NOT_RUN"}
