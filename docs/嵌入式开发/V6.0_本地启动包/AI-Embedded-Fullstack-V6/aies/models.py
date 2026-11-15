from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


FACT_STATUSES = {"VERIFIED", "USER_PROVIDED", "INFERRED", "UNKNOWN", "CONFLICT", "UNAVAILABLE"}
TASK_STATES = {
    "DISCOVERING", "BASELINED", "PLANNED", "AUTHORIZED", "EXECUTING",
    "VERIFYING", "COMPLETED", "PARTIAL", "BLOCKED", "FAILED",
    "NEEDS_REVIEW", "CANCELLED", "RESUMING",
}


@dataclass(frozen=True)
class Fact:
    key: str
    value: Any
    status: str
    source: str
    sha256: str | None = None
    confidence: float = 1.0
    scope: str = "."
    unit: str | None = None
    revision: str | None = None

    def __post_init__(self) -> None:
        if self.status not in FACT_STATUSES:
            raise ValueError(f"invalid fact status: {self.status}")

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class RouteDecision:
    project_mode: str
    depth: str
    risk: str
    domains: list[str]
    rule_files: list[str]
    ai_read_files: list[str]
    machine_rule_files: list[str]
    context_metrics: dict[str, int]
    reasons: list[str]
    omission_checks: list[str]
    unknowns: list[str] = field(default_factory=list)
    conflicts: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
