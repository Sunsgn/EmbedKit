from __future__ import annotations


def resource_budget_report(map_summary: dict | None, task_stacks: list[dict] | None, protocol_buffers: list[dict] | None) -> dict:
    missing = []
    if not map_summary:
        missing.append("MAP/ELF resource summary")
    if not task_stacks:
        missing.append("task stack measurements")
    if protocol_buffers is None:
        missing.append("protocol buffer inventory")
    if missing:
        return {"status": "UNKNOWN", "verification": "NOT_RUN", "missing": missing, "reason": "target resource data is insufficient; no budget is guessed"}
    flash = map_summary.get("flash_used_bytes")
    ram = map_summary.get("ram_used_bytes")
    if flash is None or ram is None or any(item.get("measured_high_water_bytes") is None for item in task_stacks):
        return {"status": "UNKNOWN", "verification": "NOT_RUN", "missing": ["numeric target measurements"]}
    return {"status": "MEASURED", "verification": "ARTIFACT_VERIFIED", "flash_used_bytes": flash, "ram_used_bytes": ram,
            "stack_high_water_bytes": {item["task"]: item["measured_high_water_bytes"] for item in task_stacks},
            "protocol_buffer_bytes": sum(item.get("bytes", 0) for item in protocol_buffers)}
