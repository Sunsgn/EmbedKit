from __future__ import annotations

import argparse
import json
import sys
import uuid
from pathlib import Path

from . import __version__
from .adapters import probe_capabilities
from .discovery import inspect_project, require_project_root, write_inspection
from .errors import AIESError
from .evidence import validate_completion_contract
from .packaging import create_package, validate_package
from .routing import route_task
from .state import create_input_lock, verify_input_lock


def emit(payload: dict, as_json: bool = False) -> None:
    if as_json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        status = payload.get("status", "OK")
        print(f"[{status}] {payload.get('summary', payload.get('command', 'aies'))}")
        if payload.get("output"):
            print(payload["output"])


def state_root(project: Path) -> Path:
    return project / ".aies"


def cmd_init(args: argparse.Namespace) -> dict:
    project = require_project_root(args.project_root)
    root = state_root(project)
    root.mkdir(exist_ok=True)
    state = {
        "schema_version": "1.0", "product_version": __version__, "state": "DISCOVERING",
        "project_root": str(project), "mode": args.mode, "task_id": str(uuid.uuid4()),
    }
    (root / "state.json").write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    return {"status": "PASS", "command": "init", "summary": "project runtime initialized", "output": str(root)}


def cmd_probe(args: argparse.Namespace) -> dict:
    require_project_root(args.project_root)
    capabilities = probe_capabilities()
    return {"status": "PASS", "command": "probe", "summary": "tool capability probe completed", "capabilities": capabilities}


def cmd_inspect(args: argparse.Namespace) -> dict:
    inspection = inspect_project(args.project_root)
    if not args.read_only:
        destination = state_root(Path(inspection["root"])) / "project_facts.json"
        write_inspection(inspection, destination)
    return {"status": "PASS", "command": "inspect", "summary": "project inspection completed", "inspection": inspection}


def cmd_route(args: argparse.Namespace) -> dict:
    route = route_task(args.project_root, args.task, args.mode).to_dict()
    return {"status": "PASS", "command": "route", "summary": "task route resolved", "route": route}


def cmd_plan(args: argparse.Namespace) -> dict:
    project = require_project_root(args.project_root)
    route = route_task(str(project), args.task, args.mode).to_dict()
    inspection = inspect_project(project)
    required_checks = [
        {"id": "input_lock", "kind": "static", "required": True},
        {"id": "scope", "kind": "static", "required": True},
        {"id": "evidence", "kind": "static", "required": True},
    ]
    if "software" in route["domains"] and route["risk"] != "T0":
        required_checks.append({"id": "build", "kind": "tool", "capability": "c_build", "required": True})
    task_id = str(uuid.uuid4())
    plan = {"schema_version": "1.0", "task_id": task_id, "task": args.task, "route": route, "required_checks": required_checks,
            "high_risk_actions": ["requires dedicated signed authorization"] if route["risk"] == "T4" else [],
            "completion_semantics": "all_required_checks_must_be_verified"}
    task_root = state_root(project) / "tasks" / task_id
    task_root.mkdir(parents=True, exist_ok=False)
    (task_root / "plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    inputs = [Path(f["source"]) for f in inspection["facts"] if f["key"] == "constraint_file"]
    lock = create_input_lock(inputs, project, __version__)
    (task_root / "inputs.lock.json").write_text(json.dumps(lock, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"status": "PASS", "command": "plan", "summary": "task plan and input lock created", "task_id": task_id, "plan": plan}


def cmd_status(args: argparse.Namespace) -> dict:
    project = require_project_root(args.project_root)
    path = state_root(project) / "state.json"
    state = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {"state": "NOT_INITIALIZED"}
    return {"status": "PASS", "command": "status", "summary": state["state"], "state_record": state}


def cmd_resume(args: argparse.Namespace) -> dict:
    project = require_project_root(args.project_root)
    lock_path = state_root(project) / "tasks" / args.task_id / "inputs.lock.json"
    if not lock_path.is_file():
        raise AIESError(f"task input lock not found: {args.task_id}")
    result = verify_input_lock(json.loads(lock_path.read_text(encoding="utf-8")), __version__)
    return {"status": "PASS" if result["valid"] else "BLOCKED", "command": "resume", "summary": result["state"], "dry_run": args.dry_run, "verification": result}


def cmd_verify(args: argparse.Namespace) -> dict:
    project = require_project_root(args.project_root)
    task_root = state_root(project) / "tasks" / args.task_id
    plan_path, results_path = task_root / "plan.json", task_root / "check_results.json"
    if not plan_path.is_file():
        raise AIESError(f"task plan not found: {args.task_id}")
    plan = json.loads(plan_path.read_text(encoding="utf-8"))
    results = json.loads(results_path.read_text(encoding="utf-8")) if results_path.is_file() else {}
    verification = validate_completion_contract(plan, results)
    return {"status": "PASS" if verification["valid"] else "BLOCKED", "command": "verify", "summary": "completion contract verified" if verification["valid"] else "completion contract not satisfied", "verification": verification}


def cmd_run(args: argparse.Namespace) -> dict:
    project = require_project_root(args.project_root)
    task_root = state_root(project) / "tasks" / args.task_id
    plan_path = task_root / "plan.json"
    if not plan_path.is_file():
        raise AIESError(f"task plan not found: {args.task_id}")
    plan = json.loads(plan_path.read_text(encoding="utf-8"))
    if args.dry_run:
        return {"status": "PASS", "command": "run", "summary": "dry-run only; no side effects executed", "plan": plan}
    raise AIESError("generic apply is intentionally unavailable; execute a typed adapter action with scoped authorization")


def cmd_audit(args: argparse.Namespace) -> dict:
    root = require_project_root(args.project_root)
    tasks = ["FreeRTOS UART DMA", "AD19 原理图审核", "KiCad PCB Gerber", "只整理已有项目目录", "燃气安全状态机", "MCU pinmux"]
    routes = [route_task(str(root), task).to_dict() for task in tasks]
    complete = all(route["domains"] and route["omission_checks"] for route in routes)
    return {"status": "PASS" if complete else "FAIL", "command": "audit", "summary": "routing benchmark completed", "benchmark": args.benchmark, "cases": len(routes), "routes": routes}


def cmd_package(args: argparse.Namespace) -> dict:
    root = Path(args.package_root).resolve(strict=True)
    output = Path(args.output).resolve(strict=False)
    created = create_package(root, output)
    verification = validate_package(output) if args.validate else {"valid": None, "errors": []}
    return {"status": "PASS" if verification["valid"] is not False else "FAIL", "command": "package", "summary": "candidate package created", "package": created, "verification": verification}


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(prog="python -m aies", description="AI embedded engineering automation runtime")
    result.add_argument("--version", action="version", version=__version__)
    sub = result.add_subparsers(dest="command", required=True)
    for name in ("init", "probe", "inspect", "route", "plan", "status", "verify", "resume", "run", "audit"):
        p = sub.add_parser(name)
        p.add_argument("--project-root", required=True)
        p.add_argument("--json", action="store_true")
        if name in {"init", "route", "plan"}:
            p.add_argument("--mode", default="auto")
        if name in {"route", "plan"}:
            p.add_argument("--task", required=True)
        if name == "inspect":
            p.add_argument("--read-only", action="store_true")
        if name in {"verify", "resume", "run"}:
            p.add_argument("--task-id", required=True)
        if name in {"resume", "run"}:
            p.add_argument("--dry-run", action="store_true", default=True)
        if name == "audit":
            p.add_argument("--benchmark", action="store_true")
    package = sub.add_parser("package")
    package.add_argument("--package-root", default=".")
    package.add_argument("--output", required=True)
    package.add_argument("--validate", action="store_true")
    package.add_argument("--json", action="store_true")
    return result


COMMANDS = {"init": cmd_init, "probe": cmd_probe, "inspect": cmd_inspect, "route": cmd_route, "plan": cmd_plan, "status": cmd_status, "verify": cmd_verify, "resume": cmd_resume, "run": cmd_run, "audit": cmd_audit, "package": cmd_package}


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        payload = COMMANDS[args.command](args)
        emit(payload, args.json)
        return 0 if payload.get("status") == "PASS" else 5
    except AIESError as exc:
        emit({"status": "ERROR", "summary": str(exc), "error_type": type(exc).__name__}, getattr(args, "json", False))
        return exc.exit_code
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        emit({"status": "ERROR", "summary": str(exc), "error_type": type(exc).__name__}, getattr(args, "json", False))
        return 70
