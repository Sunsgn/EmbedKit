import json
import unittest
from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parents[1]


class UnifiedConstraintTests(unittest.TestCase):
    def test_single_ai_entry_is_compact_and_complete(self):
        entry = PACKAGE_ROOT / "AGENTS.md"
        content = entry.read_text(encoding="utf-8")
        self.assertLessEqual(len(content.encode("utf-8")), 6 * 1024)
        for section in ("目标与边界", "强制顺序", "路由、风险", "授权与工程保护", "证据、完成与恢复", "专业最低要求", "输出、效率"):
            self.assertIn(section, content)
        for status in ("UNAVAILABLE", "BLOCKED", "NOT_RUN", "POLICY_ONLY", "NEEDS_REVIEW"):
            self.assertIn(status, content)

    def test_executable_rule_registries_have_required_contract_fields(self):
        required = {"rule_id", "version", "owner", "trigger", "required_inputs", "actions", "required_evidence", "acceptance", "failure_policy", "links"}
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


if __name__ == "__main__":
    unittest.main()
