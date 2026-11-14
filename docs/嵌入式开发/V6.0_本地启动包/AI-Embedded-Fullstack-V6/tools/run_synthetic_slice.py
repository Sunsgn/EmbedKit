from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
LAUNCH_ROOT = PACKAGE_ROOT.parent
sys.path.insert(0, str(PACKAGE_ROOT))

from aies.adapters import BuildAdapter  # noqa: E402
from aies.hashing import sha256_file  # noqa: E402


def main() -> int:
    evidence = LAUNCH_ROOT / "out" / "evidence" / "R3-synthetic"
    evidence.mkdir(parents=True, exist_ok=True)
    adapter = BuildAdapter(LAUNCH_ROOT, evidence)

    broken = evidence / "broken.c"
    broken.write_text("int main(void) { deliberate compile error }\n", encoding="utf-8")
    broken_output = evidence / "broken.exe"
    failed = adapter.execute(adapter.plan(broken, broken_output), authorized=True)
    failed_log = evidence / "compiler-failure.log"
    Path(failed["log"]).replace(failed_log)
    failed["log"] = str(failed_log)
    failed["log_sha256"] = sha256_file(failed_log)

    source = PACKAGE_ROOT / "examples" / "synthetic_firmware" / "main.c"
    output = evidence / "synthetic_firmware.exe"
    passed = adapter.execute(adapter.plan(source, output), authorized=True)
    passed_log = evidence / "compiler-success.log"
    Path(passed["log"]).replace(passed_log)
    passed["log"] = str(passed_log)
    passed["log_sha256"] = sha256_file(passed_log)
    verified = adapter.verify_outputs(passed)

    runtime = subprocess.run([str(output)], capture_output=True, text=True, timeout=10, shell=False) if verified["valid"] else None
    runtime_log = evidence / "runtime.log"
    runtime_log.write_text(
        f"exit_code={runtime.returncode if runtime else 'NOT_RUN'}\nstdout:\n{runtime.stdout if runtime else ''}\nstderr:\n{runtime.stderr if runtime else ''}",
        encoding="utf-8",
    )
    result = {
        "schema_version": "1.0", "fixture_scope": "host GCC only; no MCU/RTOS/device claim",
        "failure_step": {**failed, "expected_failure_observed": failed["exit_code"] != 0},
        "fixed_build": {**passed, "verification": verified},
        "runtime": {"exit_code": runtime.returncode if runtime else None, "log": str(runtime_log), "log_sha256": sha256_file(runtime_log)},
        "status": "PASS" if failed["exit_code"] != 0 and verified["valid"] and runtime and runtime.returncode == 0 else "FAIL",
    }
    result_path = evidence / "result.json"
    result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": result["status"], "evidence": str(result_path)}, ensure_ascii=False))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
