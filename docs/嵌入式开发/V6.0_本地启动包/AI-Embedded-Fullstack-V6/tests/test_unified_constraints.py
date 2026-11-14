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
            data = json.loads(path.read_text(encoding="utf-8"))
            for rule in data["rules"]:
                self.assertTrue(required.issubset(rule), path)
                self.assertNotIn(rule["rule_id"], rule_ids)
                rule_ids.add(rule["rule_id"])

    def test_readme_points_to_unified_entry(self):
        content = (PACKAGE_ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("AGENTS.md", content)
        self.assertIn("single unified AI constraint entry", content)


if __name__ == "__main__":
    unittest.main()
