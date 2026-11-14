import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from aies.cli import main


class CliTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "CONSTRAINTS.md").write_text("test scope", encoding="utf-8")

    def tearDown(self):
        self.temp.cleanup()

    def invoke(self, args):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            code = main(args)
        return code, json.loads(output.getvalue())

    def test_read_only_inspect_does_not_create_state(self):
        code, payload = self.invoke(["inspect", "--project-root", str(self.root), "--read-only", "--json"])
        self.assertEqual(0, code)
        self.assertFalse((self.root / ".aies").exists())
        self.assertEqual("PASS", payload["status"])

    def test_plan_resume_verify_and_dry_run(self):
        self.assertEqual(0, self.invoke(["init", "--project-root", str(self.root), "--json"])[0])
        code, planned = self.invoke(["plan", "--project-root", str(self.root), "--task", "修复 UART DMA", "--json"])
        self.assertEqual(0, code)
        task_id = planned["task_id"]
        self.assertEqual(0, self.invoke(["resume", "--project-root", str(self.root), "--task-id", task_id, "--dry-run", "--json"])[0])
        verify_code, verified = self.invoke(["verify", "--project-root", str(self.root), "--task-id", task_id, "--json"])
        self.assertEqual(5, verify_code)
        self.assertEqual("BLOCKED", verified["status"])
        run_code, run = self.invoke(["run", "--project-root", str(self.root), "--task-id", task_id, "--dry-run", "--json"])
        self.assertEqual(0, run_code)
        self.assertIn("no side effects", run["summary"])

    def test_resume_detects_changed_constraint(self):
        self.invoke(["init", "--project-root", str(self.root), "--json"])
        _, planned = self.invoke(["plan", "--project-root", str(self.root), "--task", "查看日志", "--json"])
        (self.root / "CONSTRAINTS.md").write_text("changed", encoding="utf-8")
        code, resumed = self.invoke(["resume", "--project-root", str(self.root), "--task-id", planned["task_id"], "--dry-run", "--json"])
        self.assertEqual(5, code)
        self.assertEqual("NEEDS_REVIEW", resumed["verification"]["state"])


if __name__ == "__main__":
    unittest.main()
