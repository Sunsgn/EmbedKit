import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from aies.directory import initialize_minimal_project, plan_directory_action
from aies.errors import InputConflict
from aies.git_guard import protect_dirty_overlap, snapshot_worktree
from aies.software import resource_budget_report


class ProjectProtectionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    @unittest.skipUnless(shutil.which("git"), "git unavailable")
    def test_dirty_user_file_overlap_is_blocked(self):
        subprocess.run(["git", "init", "-q"], cwd=self.root, check=True, capture_output=True, shell=False)
        user_file = self.root / "driver.c"
        user_file.write_text("user edit\n", encoding="utf-8")
        snapshot = snapshot_worktree(self.root)
        with self.assertRaises(InputConflict):
            protect_dirty_overlap(snapshot, ["driver.c"])
        self.assertEqual("user edit\n", user_file.read_text(encoding="utf-8"))

    def test_existing_project_normal_work_does_not_migrate_layout(self):
        plan = plan_directory_action(self.root, "PROJECT_EXISTING", "SOFTWARE")
        self.assertEqual([], plan["operations"])
        self.assertTrue(plan["preserve_existing_layout"])

    def test_new_project_creates_only_minimal_entry_set(self):
        result = initialize_minimal_project(self.root, "a" * 64, "2026-11-13")
        top = {path.name for path in self.root.iterdir()}
        self.assertEqual({".ai", "program", "开发文档", "硬件原理图PCB", "测试", "AGENTS.md", "CLAUDE.md", "README.md", ".gitignore"}, top)
        self.assertEqual(5, len(result["created_directories"]))
        profile = (self.root / ".ai" / "PROJECT_PROFILE.md").read_text(encoding="utf-8")
        self.assertIn("GPIO/Pinmux/默认安全电平", profile)
        self.assertIn("正式构建目标", profile)
        self.assertIn("框架 SHA-256", profile)

    def test_missing_target_resource_data_is_unknown_not_pass(self):
        result = resource_budget_report(None, None, None)
        self.assertEqual("UNKNOWN", result["status"])
        self.assertEqual("NOT_RUN", result["verification"])

    def test_measured_resource_data_is_reported_without_platform_defaults(self):
        result = resource_budget_report(
            {"flash_used_bytes": 1200, "ram_used_bytes": 300},
            [{"task": "worker", "measured_high_water_bytes": 96}],
            [{"name": "rx", "bytes": 128}],
        )
        self.assertEqual("MEASURED", result["status"])
        self.assertEqual(128, result["protocol_buffer_bytes"])


if __name__ == "__main__":
    unittest.main()
