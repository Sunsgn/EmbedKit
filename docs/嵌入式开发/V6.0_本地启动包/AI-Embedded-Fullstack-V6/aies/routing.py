from __future__ import annotations

from pathlib import Path

from .discovery import discover_constraint_files, require_project_root
from .models import RouteDecision

DOMAIN_RULES = {
    "core": ("rules/core/CONSTRAINTS.md", "rules/core/RULES.md", "rules/core/rules.json"),
    "software": ("rules/software/CONSTRAINTS.md", "rules/software/RULES.md", "rules/software/rules.json"),
    "hardware": ("rules/hardware/CONSTRAINTS.md", "rules/hardware/RULES.md", "rules/hardware/rules.json"),
    "pcb": ("rules/pcb/CONSTRAINTS.md", "rules/pcb/RULES.md", "rules/pcb/rules.json"),
    "integration": ("rules/integration/CONSTRAINTS.md", "rules/integration/RULES.md", "rules/integration/rules.json"),
    "verification": ("rules/verification/CONSTRAINTS.md", "rules/verification/RULES.md", "rules/verification/rules.json"),
    "manufacturing": ("rules/manufacturing/CONSTRAINTS.md", "rules/manufacturing/RULES.md", "rules/manufacturing/rules.json"),
    "security": ("rules/security_release/CONSTRAINTS.md", "rules/security_release/RULES.md", "rules/security_release/rules.json"),
    "directory": ("rules/directory/CONSTRAINTS.md", "rules/directory/RULES.md", "rules/directory/rules.json"),
    "system": ("rules/system/CONSTRAINTS.md", "rules/system/RULES.md", "rules/system/rules.json"),
    "bringup_debug": ("rules/bringup_debug/CONSTRAINTS.md", "rules/bringup_debug/RULES.md", "rules/bringup_debug/rules.json"),
    "build_artifacts": ("rules/build_artifacts/CONSTRAINTS.md", "rules/build_artifacts/RULES.md", "rules/build_artifacts/rules.json"),
    "embedded_linux": ("rules/embedded_linux/CONSTRAINTS.md", "rules/embedded_linux/RULES.md", "rules/embedded_linux/rules.json"),
    "communication": ("rules/communication/CONSTRAINTS.md", "rules/communication/RULES.md", "rules/communication/rules.json"),
    "reliability": ("rules/reliability/CONSTRAINTS.md", "rules/reliability/RULES.md", "rules/reliability/rules.json"),
    "mechanical_thermal": ("rules/mechanical_thermal/CONSTRAINTS.md", "rules/mechanical_thermal/RULES.md", "rules/mechanical_thermal/rules.json"),
    "extension": ("rules/extension/CONSTRAINTS.md", "rules/extension/RULES.md", "rules/extension/rules.json"),
}

SIGNALS = {
    "software": ("软件", "代码", "驱动", "uart", "dma", "can", "modbus", "rtos", "freertos", "liteos", "osal", "ota", "adc", "固件", "日志"),
    "hardware": ("原理图", "schematic", "erc", "电路", "器件", "电源", "传感"),
    "pcb": ("pcb", "布线", "布局", "drc", "kicad", "板框", "净类", "gerber"),
    "directory": ("目录", "整理", "organize", "归档", "迁移资料"),
    "manufacturing": ("产测", "生产", "制造", "bom", "工装", "校准", "标定", "量产"),
    "security": ("安全", "阀", "燃气", "认证", "发布", "安全状态机"),
    "integration": ("pinmux", "引脚", "软硬件", "接口映射", "电压域", "硬件版本"),
    "verification": ("测试", "回归", "hil", "故障注入", "验收"),
    "system": ("需求", "架构", "系统设计", "资源预算", "新品", "eco", "ecn"),
    "bringup_debug": ("bring-up", "bringup", "上电", "板级调试", "时钟", "复位", "gpio", "中断", "irq", "崩溃"),
    "build_artifacts": ("elf", "map", "bin", "hex", "构建产物", "链接", "工具链", "keil", "iar", "cmake", "ninja"),
    "embedded_linux": ("embedded linux", "嵌入式linux", "内核", "kernel", "设备树", "device tree", "dts", "dtb", "rootfs"),
    "communication": ("串口", "uart", "i2c", "spi", "can", "tcp", "udp", "websocket", "网络", "协议"),
    "reliability": ("可靠性", "emc", "esd", "eft", "浪涌", "温湿度", "振动", "寿命", "看门狗", "长期运行"),
    "mechanical_thermal": ("结构", "外壳", "热设计", "散热", "公差", "防护", "装配", "线束"),
    "extension": ("适配器", "插件", "扩展", "解析器", "adapter", "plugin", "schema"),
}


def _hits(task_lower: str, domain: str) -> list[str]:
    return [signal for signal in SIGNALS[domain] if signal in task_lower]


def route_task(project_root: str, task: str, mode: str = "auto") -> RouteDecision:
    root = require_project_root(project_root)
    text = task.strip().lower()
    if not text:
        raise ValueError("task must not be empty")
    domains = ["core"]
    reasons = ["core authorization, evidence and project-protection rules always apply"]
    matched: dict[str, list[str]] = {}
    for domain in SIGNALS:
        hits = _hits(text, domain)
        if hits:
            matched[domain] = hits
            domains.append(domain)
            reasons.append(f"{domain}: task signals {', '.join(hits[:4])}")

    unknowns: list[str] = []
    if len(domains) == 1:
        domains += ["software", "verification"]
        unknowns.append("task domain was not explicit; safe read-only software/general verification fallback selected")
        reasons.append("no known signal matched; editing must remain blocked until project facts resolve impact")

    safety_terms = ("安全", "燃气", "阀", "失效", "认证")
    cross_terms = ("pinmux", "引脚", "软硬件", "接口", "标定", "adc")
    if any(term in text for term in safety_terms):
        for domain in ("security", "integration", "verification"):
            if domain not in domains:
                domains.append(domain)
        reasons.append("safety impact adds security, integration and verification contracts")
    if any(term in text for term in cross_terms):
        for domain in ("integration", "verification"):
            if domain not in domains:
                domains.append(domain)
        reasons.append("interface/calibration impact adds bidirectional integration verification")
    if "pcb" in domains and any(term in text for term in ("gerber", "钻孔", "pnp", "制造输出", "生产输出")):
        if "manufacturing" not in domains:
            domains.append("manufacturing")
        reasons.append("PCB fabrication-output request adds manufacturing traceability checks")

    pure_directory = "directory" in domains and not any(d in domains for d in ("software", "hardware", "pcb", "manufacturing", "security"))
    if pure_directory:
        depth, risk = "LIGHT", "T0"
    elif "security" in domains or len(domains) >= 5:
        depth, risk = "FULL", "T3"
    elif "pcb" in domains or "hardware" in domains or "integration" in domains:
        depth, risk = "STANDARD", "T2"
    else:
        depth, risk = "STANDARD", "T1"
    if any(term in text for term in ("查看", "只读", "审核", "分析", "inspect", "audit")):
        risk = "T0"
        if depth != "FULL":
            depth = "LIGHT"
    if any(term in text for term in ("烧录", "下载设备", "量产发布", "制板", "正式发布")):
        risk = "T4"

    project_mode = mode if mode != "auto" else ("PROJECT_EXISTING" if any(root.iterdir()) else "PROJECT_NEW")
    ai_read_files = [path for domain in domains for path in DOMAIN_RULES[domain][:2]]
    machine_rule_files = [DOMAIN_RULES[domain][2] for domain in domains]
    task_tokens = {token for token in text.replace("/", " ").replace("-", " ").split() if len(token) >= 2}
    for constraint in discover_constraint_files(root):
        rel = constraint.relative_to(root).as_posix()
        if rel == "AGENTS.md":
            reasons.append("project root AGENTS.md is the already-loaded entry and is not loaded twice")
            continue
        scope = constraint.parent.relative_to(root).as_posix().lower()
        root_scoped = constraint.parent == root or rel == ".ai/PROJECT_PROFILE.md"
        scope_match = any(token in scope for token in task_tokens)
        if root_scoped or scope_match:
            ai_read_files.append(rel)
            reasons.append(f"project constraint selected for applicable scope: {rel}")
    rules = [*ai_read_files, *machine_rule_files]
    package_root = Path(__file__).resolve().parents[1]
    entry_bytes = (package_root / "AGENTS.md").stat().st_size
    selected_bytes = entry_bytes
    for relative in ai_read_files:
        candidate = (package_root / relative) if relative.startswith("rules/") else (root / relative)
        if candidate.is_file():
            selected_bytes += candidate.stat().st_size
    full_domain_bytes = entry_bytes + sum(sum((package_root / path).stat().st_size for path in values[:2]) for values in DOMAIN_RULES.values())
    context_metrics = {
        "l0_bytes": entry_bytes,
        "selected_ai_bytes": selected_bytes,
        "all_domain_bytes": full_domain_bytes,
        "avoided_bytes": max(0, full_domain_bytes - selected_bytes),
    }
    omissions = [
        "checked for safety-critical impact",
        "checked for hardware/software interface impact",
        "checked for manufacturing and field compatibility impact",
        "unknown domain does not authorize editing",
    ]
    return RouteDecision(project_mode, depth, risk, domains, rules, ai_read_files, machine_rule_files, context_metrics, reasons, omissions, unknowns)
