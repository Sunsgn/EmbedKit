from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path

from .errors import AuthorizationRequired, CapabilityUnavailable, InputConflict
from .hashing import is_within, sha256_file


@dataclass
class Capability:
    adapter: str
    capability: str
    status: str
    executable: str | None
    version: str | None
    detail: str


def _version(executable: str, args: list[str]) -> str | None:
    try:
        result = subprocess.run([executable, *args], capture_output=True, text=True, timeout=10, shell=False)
        output = (result.stdout or result.stderr).strip().splitlines()
        return output[0][:300] if output else None
    except (OSError, subprocess.SubprocessError):
        return None


def probe_capabilities() -> list[dict]:
    specifications = [
        ("git", "version_control", ["--version"]),
        ("gcc", "c_build", ["--version"]),
        ("cmake", "cmake_build", ["--version"]),
        ("ninja", "ninja_build", ["--version"]),
        ("kicad-cli", "kicad_erc_drc", ["--version"]),
        ("AltiumDesigner.exe", "ad19_script_api", []),
        ("IarBuild.exe", "iar_build", ["--help"]),
        ("UV4.exe", "keil_build", ["-h"]),
    ]
    results = []
    for name, capability, args in specifications:
        executable = shutil.which(name)
        if executable:
            version = _version(executable, args) if args else None
            status = "AVAILABLE_VERIFIED" if version else "AVAILABLE_UNVERIFIED"
            detail = "executable found and version command executed" if version else "executable found; version/license not verified"
        else:
            version, status, detail = None, "UNAVAILABLE", "executable not found on PATH"
        results.append(asdict(Capability(name, capability, status, executable, version, detail)))
    results.append(asdict(Capability(
        "host-policy", "mandatory_execution_path", "POLICY_ONLY", None, None,
        "CLI enforces adapters, but the host still exposes filesystem/shell paths outside this Python process",
    )))
    results.append(asdict(Capability(
        "hil", "real_device_test", "BLOCKED_BY_AUTH", None, None,
        "no device identity, port, firmware identity, or dedicated authorization supplied",
    )))
    return results


class BuildAdapter:
    def __init__(self, project_root: Path, evidence_root: Path):
        self.project_root = project_root.resolve(strict=True)
        self.evidence_root = evidence_root.resolve(strict=False)

    def probe(self) -> dict:
        executable = shutil.which("gcc")
        return {
            "adapter": "gcc", "capability": "c_build",
            "status": "AVAILABLE_VERIFIED" if executable else "UNAVAILABLE",
            "executable": executable, "version": _version(executable, ["--version"]) if executable else None,
        }

    def plan(self, source: Path, output: Path) -> dict:
        source = source.resolve(strict=True)
        output = output.resolve(strict=False)
        if not is_within(source, self.project_root) or not is_within(output, self.project_root):
            raise InputConflict("build input/output must stay within project root")
        executable = shutil.which("gcc")
        if not executable:
            raise CapabilityUnavailable("gcc is unavailable")
        return {"argv": [executable, "-std=c11", "-Wall", "-Wextra", "-Werror", str(source), "-o", str(output)], "cwd": str(self.project_root)}

    def execute(self, plan: dict, authorized: bool, timeout: int = 60) -> dict:
        if not authorized:
            raise AuthorizationRequired("isolated build requires explicit workspace authorization")
        self.evidence_root.mkdir(parents=True, exist_ok=True)
        result = subprocess.run(plan["argv"], cwd=plan["cwd"], capture_output=True, text=True, timeout=timeout, shell=False)
        log = self.evidence_root / "compiler.log"
        log.write_text(
            "argv=" + json.dumps(plan["argv"], ensure_ascii=False) +
            f"\nexit_code={result.returncode}\nstdout:\n{result.stdout}\nstderr:\n{result.stderr}", encoding="utf-8",
        )
        output = Path(plan["argv"][-1])
        return {
            "exit_code": result.returncode, "log": str(log), "log_sha256": sha256_file(log),
            "output": str(output) if output.is_file() else None,
            "output_sha256": sha256_file(output) if output.is_file() else None,
        }

    def verify_outputs(self, result: dict) -> dict:
        errors = []
        if result.get("exit_code") != 0:
            errors.append("compiler exit code was non-zero")
        output = result.get("output")
        if not output or not Path(output).is_file():
            errors.append("expected binary was not produced")
        elif sha256_file(Path(output)) != result.get("output_sha256"):
            errors.append("binary hash changed after build")
        return {"valid": not errors, "errors": errors}

    def collect_evidence(self, result: dict) -> dict:
        return result

    def rollback_plan(self) -> dict:
        return {"automatic": False, "reason": "output deletion is destructive and requires separately scoped authorization"}
