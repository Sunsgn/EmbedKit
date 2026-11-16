import json
import unittest
from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parents[1]


class UnifiedConstraintTests(unittest.TestCase):
    def test_single_ai_entry_is_compact_and_complete(self):
        entry = PACKAGE_ROOT / "AGENTS.md"
        content = entry.read_text(encoding="utf-8")
        self.assertLessEqual(len(content.encode("utf-8")), 3 * 1024)
        for section in ("强制加载顺序", "不可省略的全局底线", "使用定位"):
            self.assertIn(section, content)
        for status in ("UNAVAILABLE", "BLOCKED", "NOT_RUN", "POLICY_ONLY", "NEEDS_REVIEW"):
            self.assertIn(status, content)

    def test_executable_rule_registries_have_required_contract_fields(self):
        required = {"rule_id", "version", "owner", "trigger", "applies_when", "required_inputs", "actions", "required_evidence", "acceptance", "failure_policy", "links"}
        rule_ids = set()
        files = sorted((PACKAGE_ROOT / "rules").glob("*/rules.json"))
        self.assertGreaterEqual(len(files), 9)
        for path in files:
            detailed = path.with_name("CONSTRAINTS.md")
            self.assertTrue(detailed.is_file(), detailed)
            content = detailed.read_text(encoding="utf-8")
            self.assertGreater(len(content.encode("utf-8")), 1800, detailed)
            for term in ("适用范围", "证据", "验收", "失败"):
                self.assertIn(term, content, detailed)
            data = json.loads(path.read_text(encoding="utf-8"))
            self.assertGreaterEqual(len(data["rules"]), 6, path)
            for rule in data["rules"]:
                self.assertTrue(required.issubset(rule), path)
                self.assertNotIn(rule["rule_id"], rule_ids)
                rule_ids.add(rule["rule_id"])

    def test_readme_points_to_unified_entry(self):
        content = (PACKAGE_ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("AGENTS.md", content)
        self.assertIn("detailed professional", content)

    def test_route_returns_human_constraints_and_machine_rules(self):
        from aies.routing import route_task
        route = route_task(str(PACKAGE_ROOT), "修改代码函数返回值")
        self.assertIn("rules/core/CONSTRAINTS.md", route.rule_files)
        self.assertIn("rules/software/CONSTRAINTS.md", route.rule_files)
        self.assertIn("rules/core/rules.json", route.rule_files)
        self.assertIn("rules/software/rules.json", route.rule_files)
        self.assertEqual(
            ["rules/core/CONSTRAINTS.md", "rules/core/RULES.md", "rules/software/CONSTRAINTS.md", "rules/software/RULES.md"],
            route.ai_read_files,
        )
        self.assertEqual(
            ["rules/core/rules.json", "rules/software/rules.json"],
            route.machine_rule_files,
        )
        self.assertTrue(all(path.endswith(".md") for path in route.ai_read_files))
        self.assertTrue(all(path.endswith(".json") for path in route.machine_rule_files))
        self.assertLess(route.context_metrics["selected_ai_bytes"], route.context_metrics["all_domain_bytes"])
        self.assertGreater(route.context_metrics["avoided_bytes"], 0)

    def test_software_task_does_not_load_unrelated_professional_text(self):
        from aies.routing import route_task
        route = route_task(str(PACKAGE_ROOT), "修改代码函数返回值")
        self.assertNotIn("rules/hardware/CONSTRAINTS.md", route.ai_read_files)
        self.assertNotIn("rules/pcb/CONSTRAINTS.md", route.ai_read_files)
        self.assertNotIn("rules/manufacturing/CONSTRAINTS.md", route.ai_read_files)

    def test_generated_atomic_rule_markdown_is_in_sync(self):
        import sys
        sys.path.insert(0, str(PACKAGE_ROOT / "tools"))
        from render_rules import render_registry
        for registry in sorted((PACKAGE_ROOT / "rules").glob("*/rules.json")):
            rendered = registry.with_name("RULES.md")
            self.assertEqual(render_registry(registry), rendered.read_text(encoding="utf-8"), rendered)

    def test_project_agent_template_enforces_on_demand_loading(self):
        content = (PACKAGE_ROOT / "templates" / "PROJECT_AGENTS.md").read_text(encoding="utf-8")
        self.assertIn("不得预读全部专业规则", content)
        self.assertIn("ai_read_files", content)
        self.assertIn("machine_rule_files", content)

    def test_software_constraints_are_concrete_not_a_checklist(self):
        content = (PACKAGE_ROOT / "rules" / "software" / "CONSTRAINTS.md").read_text(encoding="utf-8")
        self.assertGreater(len(content.encode("utf-8")), 14000)
        for required in (
            "ISR 中禁止", "volatile", "tick 回绕", "优先级反转", "I²C 要处理 NACK",
            "旧 output", "UNKNOWN/NOT_RUN", "半包、粘包", "任意指令点掉电",
            "不得用经验值", "只允许报告实际达到",
        ):
            self.assertIn(required, content)

    def test_project_profile_template_captures_project_specific_values(self):
        content = (PACKAGE_ROOT / "templates" / "PROJECT_PROFILE.md").read_text(encoding="utf-8")
        for required in (
            "MCU/SoC", "RTOS/内核", "正式构建目标", "GPIO/Pinmux", "DMA 通道",
            "队列/环形缓冲容量", "协议名称", "Bootloader/OTA", "已授权操作", "UNKNOWN",
        ):
            self.assertIn(required, content)

    def test_every_professional_domain_has_detailed_executable_constraints(self):
        required_terms = {
            "core": ("符号链接逃逸", "幂等键", "无证据 PASS"),
            "system": ("资源预算", "双向追踪", "残余风险"),
            "hardware": ("绝对最大值", "误差预算", "反向供电"),
            "pcb": ("未布线", "独立查看器", "PLAN_ONLY"),
            "integration": ("Pinmux", "兼容矩阵", "同一时间基准"),
            "verification": ("首次失败", "随机", "环境失败"),
            "manufacturing": ("首次通过率", "序列号", "工装自检"),
            "security_release": ("防重放", "固定 IV/nonce", "正式发布"),
            "directory": ("非空目录", "源→目标映射", "净室验证"),
            "bringup_debug": ("限流电源", "中断风暴", "同哈希"),
            "build_artifacts": ("VMA/LMA", "旧 output", "测试签名"),
            "embedded_linux": ("/proc/device-tree", "copy_to/from_user", "Restart=always"),
            "communication": ("一次 `recv` 不等于一帧", "bus-off", "半包、粘包"),
            "reliability": ("通用包不提供固定电压", "加速模型", "样本量"),
            "mechanical_thermal": ("公差链", "θJA", "名义模型无干涉"),
            "extension": ("默认拒绝", "解析炸弹", "单插件异常"),
        }
        for domain, terms in required_terms.items():
            path = PACKAGE_ROOT / "rules" / domain / "CONSTRAINTS.md"
            content = path.read_text(encoding="utf-8")
            self.assertGreaterEqual(len(content.encode("utf-8")), 4200, path)
            self.assertGreaterEqual(content.count("\n## "), 8, path)
            for term in terms:
                self.assertIn(term, content, path)


if __name__ == "__main__":
    unittest.main()
