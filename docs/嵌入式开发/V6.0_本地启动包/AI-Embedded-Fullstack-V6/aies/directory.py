from __future__ import annotations

from pathlib import Path

from .errors import InputConflict

CORE_DIRS = ("program", "开发文档", "硬件原理图PCB", "测试")


def plan_directory_action(root: Path, mode: str, task_kind: str) -> dict:
    root = root.resolve(strict=True)
    if mode == "PROJECT_EXISTING" and task_kind != "DIRECTORY":
        return {"mode": mode, "operations": [], "preserve_existing_layout": True, "reason": "ordinary engineering work must not migrate an existing project"}
    return {"mode": mode, "operations": ["inventory", "map", "verify"], "preserve_existing_layout": True}


def initialize_minimal_project(root: Path, framework_sha256: str, date: str) -> dict:
    root = root.resolve(strict=True)
    existing = [path for path in root.iterdir() if path.name not in {".git"}]
    if existing:
        raise InputConflict("NEW initialization requires an empty project root")
    ai = root / ".ai"
    ai.mkdir()
    for name in CORE_DIRS:
        (root / name).mkdir()
    (root / "AGENTS.md").write_text("Directory tasks read .ai/PROJECT_PROFILE.md; ordinary development preserves the existing layout.\n", encoding="utf-8")
    (root / "CLAUDE.md").write_text("Directory tasks read .ai/PROJECT_PROFILE.md; reads do not authorize destructive or Git operations.\n", encoding="utf-8")
    (root / "README.md").write_text("# Embedded project\n\nProject facts are initially unknown; update `.ai/PROJECT_PROFILE.md` from verified sources.\n", encoding="utf-8")
    (root / ".gitignore").write_text("# Add only verified local outputs; no broad patterns are assumed.\n", encoding="utf-8")
    template = Path(__file__).resolve().parents[1] / "templates" / "PROJECT_PROFILE.md"
    profile = template.read_text(encoding="utf-8")
    provenance = (
        "\n## 目录框架来源\n\n"
        f"- 目录框架：V1.20\n- 框架 SHA-256：{framework_sha256}\n- 完整读取日期：{date}\n"
    )
    (ai / "PROJECT_PROFILE.md").write_text(profile + provenance, encoding="utf-8")
    return {"created_directories": [".ai", *CORE_DIRS], "created_files": ["AGENTS.md", "CLAUDE.md", "README.md", ".gitignore", ".ai/PROJECT_PROFILE.md"]}
