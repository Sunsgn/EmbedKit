from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
LAUNCH_ROOT = PACKAGE_ROOT.parent
sys.path.insert(0, str(PACKAGE_ROOT))

from aies.packaging import validate_package  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("package", type=Path)
    args = parser.parse_args()
    archive = args.package.resolve(strict=True)
    validation = validate_package(archive)
    with tempfile.TemporaryDirectory(prefix="aies-clean-room-") as directory:
        root = Path(directory)
        with zipfile.ZipFile(archive) as source:
            source.extractall(root)
        tests = subprocess.run([sys.executable, "-m", "unittest", "discover", "-s", "tests", "-v"], cwd=root, capture_output=True, text=True, timeout=120, shell=False)
        cli = subprocess.run([sys.executable, "-m", "aies", "--help"], cwd=root, capture_output=True, text=True, timeout=20, shell=False)
    status = "PASS" if validation["valid"] and tests.returncode == 0 and cli.returncode == 0 else "FAIL"
    report = {"status": status, "package": str(archive), "package_validation": validation, "tests_exit_code": tests.returncode,
              "cli_exit_code": cli.returncode, "tests_tail": (tests.stdout + tests.stderr)[-8000:], "cli_help_head": cli.stdout[:1000]}
    destination = LAUNCH_ROOT / "out" / "evidence" / "R6-clean-room.json"
    destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": status, "evidence": str(destination)}, ensure_ascii=False))
    return 0 if status == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
