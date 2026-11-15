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
        route = route_task(str(PACKAGE_ROOT), "修改 UART DMA 驱动")
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
        route = route_task(str(PACKAGE_ROOT), "修改 UART DMA 驱动")
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


if __name__ == "__main__":
    unittest.main()
