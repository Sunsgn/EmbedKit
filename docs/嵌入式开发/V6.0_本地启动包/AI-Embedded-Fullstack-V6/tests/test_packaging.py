import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from aies.packaging import create_package, validate_package


class PackagingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / "package"
        self.root.mkdir()
        (self.root / "README.md").write_text("hello\n", encoding="utf-8")

    def tearDown(self):
        self.temp.cleanup()

    def test_deterministic_package_and_validation(self):
        first = Path(self.temp.name) / "a.zip"
        second = Path(self.temp.name) / "b.zip"
        one = create_package(self.root, first)
        two = create_package(self.root, second)
        self.assertEqual(one["sha256"], two["sha256"])
        self.assertTrue(validate_package(first)["valid"])

    def test_missing_or_added_file_fails_exactly(self):
        original = Path(self.temp.name) / "original.zip"
        create_package(self.root, original)
        tampered = Path(self.temp.name) / "tampered.zip"
        with zipfile.ZipFile(original) as source, zipfile.ZipFile(tampered, "w") as target:
            for name in source.namelist():
                if name != "README.md":
                    target.writestr(name, source.read(name))
            target.writestr("extra.txt", b"unexpected")
        result = validate_package(tampered)
        self.assertFalse(result["valid"])
        self.assertTrue(any("README.md" in error for error in result["errors"]))
        self.assertTrue(any("extra.txt" in error for error in result["errors"]))


if __name__ == "__main__":
    unittest.main()
