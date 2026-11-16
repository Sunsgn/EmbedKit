import importlib.util
import re
import tempfile
import unittest
import zipfile
from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parents[1]
LAUNCH_ROOT = PACKAGE_ROOT.parent
RUNTIME_ROOT = LAUNCH_ROOT / "AI-Embedded-Constraints-V6-Runtime-MD"
SCRIPT = PACKAGE_ROOT / "tools" / "package_runtime_md.py"
SPEC = importlib.util.spec_from_file_location("package_runtime_md", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


class RuntimeMarkdownPackageTests(unittest.TestCase):
    def test_runtime_tree_is_complete_and_markdown_only(self):
        result = MODULE.validate_runtime(RUNTIME_ROOT)
        self.assertTrue(result["valid"], result["errors"])
        self.assertTrue(result["markdown_only"])
        self.assertEqual(25, result["domains"])
        self.assertEqual(10, result["workflows"])
        self.assertEqual(6, result["templates"])

    def test_runtime_entry_is_compact_and_routes_on_demand(self):
        entry = (RUNTIME_ROOT / "AGENTS.md").read_text(encoding="utf-8")
        self.assertLessEqual(len(entry.encode("utf-8")), 5 * 1024)
        self.assertIn("不得预读全部专业约束", entry)
        self.assertIn("PROJECT_PROFILE.md", entry)
        self.assertIn("constraints/INDEX.md", entry)

    def test_every_professional_section_has_a_unique_stable_rule_id(self):
        ids = []
        for path in sorted((RUNTIME_ROOT / ".ai" / "constraints").glob("*.md")):
            if path.name == "INDEX.md":
                continue
            headings = [line for line in path.read_text(encoding="utf-8").splitlines() if line.startswith("## ")]
            self.assertGreaterEqual(len(headings), 8, path)
            for heading in headings:
                match = re.match(r"^## ([A-Z]+-[0-9]{3})：", heading)
                self.assertIsNotNone(match, f"missing stable rule ID: {path}: {heading}")
                ids.append(match.group(1))
        self.assertEqual(len(ids), len(set(ids)))
        self.assertGreaterEqual(len(ids), 220)

    def test_added_specialist_domains_have_concrete_engineering_gates(self):
        required = {
            "power_energy.md": ("反向供电", "唤醒风暴", "典型电流"),
            "bootloader_ota.md": ("任意指令点掉电", "最后可启动", "禁止降级"),
            "rf_wireless.md": ("OTA 良好", "共存", "模组证书"),
            "motor_control_power.md": ("直通", "急停", "上下桥互锁"),
            "sensing_calibration.md": ("不确定度", "只保存最终系数", "独立验证点"),
            "compliance_certification.md": ("AI 不得自行作法律结论", "预扫", "量产不一致"),
            "field_maintenance.md": ("状态未知的非幂等写入", "RMA", "日志风暴"),
            "supply_chain_lifecycle.md": ("完整 MPN", "PCN/EOL", "可疑批次"),
        }
        root = RUNTIME_ROOT / ".ai" / "constraints"
        for name, terms in required.items():
            content = (root / name).read_text(encoding="utf-8")
            self.assertGreaterEqual(len(content.encode("utf-8")), 4500, name)
            for term in terms:
                self.assertIn(term, content, name)

    def test_deterministic_zip_contains_only_markdown(self):
        with tempfile.TemporaryDirectory() as directory:
            first = Path(directory) / "first.zip"
            second = Path(directory) / "second.zip"
            one = MODULE.create_runtime_package(RUNTIME_ROOT, first)
            two = MODULE.create_runtime_package(RUNTIME_ROOT, second)
            self.assertEqual(one["sha256"], two["sha256"])
            with zipfile.ZipFile(first) as archive:
                names = archive.namelist()
            self.assertTrue(names)
            self.assertTrue(all(name.lower().endswith(".md") for name in names))
            self.assertIn("AGENTS.md", names)
            self.assertIn(".ai/constraints/core.md", names)


if __name__ == "__main__":
    unittest.main()
