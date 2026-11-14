import shutil
import tempfile
import unittest
from pathlib import Path

from aies.adapters import BuildAdapter, probe_capabilities
from aies.errors import AuthorizationRequired


class BuildAdapterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.evidence = self.root / "evidence"
        self.adapter = BuildAdapter(self.root, self.evidence)

    def tearDown(self):
        self.temp.cleanup()

    @unittest.skipUnless(shutil.which("gcc"), "GCC unavailable")
    def test_real_host_compilation_and_artifact_hash(self):
        source = self.root / "main.c"
        source.write_text("int main(void){return 0;}\n", encoding="utf-8")
        output = self.root / "firmware.exe"
        result = self.adapter.execute(self.adapter.plan(source, output), authorized=True)
        self.assertTrue(self.adapter.verify_outputs(result)["valid"])
        self.assertTrue(result["output_sha256"])

    @unittest.skipUnless(shutil.which("gcc"), "GCC unavailable")
    def test_compile_error_is_real_fail_not_pass(self):
        source = self.root / "broken.c"
        source.write_text("int main(void) { syntax error }\n", encoding="utf-8")
        output = self.root / "firmware.exe"
        result = self.adapter.execute(self.adapter.plan(source, output), authorized=True)
        self.assertNotEqual(0, result["exit_code"])
        self.assertFalse(self.adapter.verify_outputs(result)["valid"])

    @unittest.skipUnless(shutil.which("gcc"), "GCC unavailable")
    def test_build_without_authorization_is_denied(self):
        source = self.root / "main.c"
        source.write_text("int main(void){return 0;}\n", encoding="utf-8")
        with self.assertRaises(AuthorizationRequired):
            self.adapter.execute(self.adapter.plan(source, self.root / "x.exe"), authorized=False)

    def test_probe_truthfully_reports_policy_only_and_eda(self):
        capabilities = probe_capabilities()
        host = next(c for c in capabilities if c["adapter"] == "host-policy")
        self.assertEqual("POLICY_ONLY", host["status"])
        kicad = next(c for c in capabilities if c["adapter"] == "kicad-cli")
        self.assertIn(kicad["status"], {"UNAVAILABLE", "AVAILABLE_VERIFIED", "AVAILABLE_UNVERIFIED"})


if __name__ == "__main__":
    unittest.main()
