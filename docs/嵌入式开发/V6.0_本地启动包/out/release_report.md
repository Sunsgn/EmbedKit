# V6.0 RC release report

Generated: 2026-11-15T12:00:50.310398+00:00

This is an RC candidate, not a production or safety approval. Acceptance: PASS 48, FAIL 0, BLOCKED 6, NOT_RUN 0.

Verified now: input integrity, scoped routing/control-kernel behaviors, negative authorization/evidence/recovery checks, real host GCC synthetic failure/fix/build/runtime, deterministic integration contracts, and package tamper detection.

Not verified: native KiCad/AD19 edit/ERC/DRC/manufacturing workflow, target IAR/Keil builds, A22 source analysis, real MCU/RTOS resource results, HIL/device/safety/production approval, and remaining Token/resume workflow cases. These remain BLOCKED or NOT_RUN in `test_results.json`.

Host enforcement is `POLICY_ONLY`; the Python runtime cannot mediate every alternative host write path.
