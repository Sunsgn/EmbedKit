from __future__ import annotations

import json
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parents[1]


def _items(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value]
    return [str(value)] if value not in (None, "") else []


def render_registry(path: Path) -> str:
    data = json.loads(path.read_text(encoding="utf-8"))
    lines = [
        "# 原子约束规则",
        "",
        "> 本文件由同目录 `rules.json` 确定性生成，供 AI 按需读取；修改规则时应修改 JSON 后重新生成。",
        "",
        f"- Schema：`{data.get('schema_version', 'UNKNOWN')}`",
        f"- 规则数量：{len(data.get('rules', []))}",
        "",
    ]
    for rule in data.get("rules", []):
        lines += [
            f"## {rule['rule_id']} — {rule.get('owner', '')}",
            "",
            f"- 版本：`{rule.get('version', '')}`",
            f"- 触发：{', '.join(_items(rule.get('trigger')))}",
            f"- 适用条件：{rule.get('applies_when', '')}",
            "- 必需输入：",
            *[f"  - {item}" for item in _items(rule.get("required_inputs"))],
            "- 强制动作：",
            *[f"  {index}. {item}" for index, item in enumerate(_items(rule.get("actions")), 1)],
            "- 必需证据：",
            *[f"  - {item}" for item in _items(rule.get("required_evidence"))],
            "- 通过条件（全部满足）：",
            *[f"  - {item}" for item in _items(rule.get("acceptance"))],
            f"- 失败动作：{rule.get('failure_policy', '')}",
            f"- 关联验收：{', '.join(_items(rule.get('links')))}",
            "",
        ]
    return "\n".join(lines).rstrip() + "\n"


def render_all(root: Path = PACKAGE_ROOT) -> list[Path]:
    outputs = []
    for registry in sorted((root / "rules").glob("*/rules.json")):
        destination = registry.with_name("RULES.md")
        destination.write_text(render_registry(registry), encoding="utf-8", newline="\n")
        outputs.append(destination)
    return outputs


if __name__ == "__main__":
    for output in render_all():
        print(output.relative_to(PACKAGE_ROOT).as_posix())
