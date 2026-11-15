# V6.0 development handoff

- Phase: R6 (`PARTIAL`, because six external-tool/input cases are blocked)
- Workspace: `D:\python\EmbedKit\docs\嵌入式开发\V6.0_本地启动包`
- Host: `ZJZL-20240201AB`
- Inputs: 15 files verified by `04-核对输入完整性.ps1`
- V5.1.4 baseline SHA-256: `de55a35910687fa357de8add7e5b3973a1b17e01a8ba276c2ce6f27d78168019`
- Unified AI entry: `AI-Embedded-Fullstack-V6/AGENTS.md` (single human/AI constraint authority; executable projections are under `rules/`).
- Token loading: L0 is 2620 bytes; route output separates `ai_read_files` from `machine_rule_files`, reports selected/all/avoided bytes, and forbids preloading unrelated domains. New-project root template: `templates/PROJECT_AGENTS.md`.
- Detailed professional constraints: `rules/{core,software,hardware,pcb,integration,verification,manufacturing,security_release,directory}/CONSTRAINTS.md`; `rules/README.md` is the catalog and routing loads applicable files.
- Atomic constraints: 56 structured rules across nine domains; each domain has deterministic AI-readable `RULES.md` generated from `rules.json`, with trigger, applicability, inputs, ordered actions, evidence, all-pass acceptance, and failure policy.
- Implemented: runnable `python -m aies` CLI; discovery; scoped project constraints; impact routing; planning/input locks; signed authorization validation; evidence and completion gates; append-only journal/recovery primitives; single-writer and dirty-worktree protection; typed GCC build adapter; deterministic interface/version/NVM/safety/directory validators; deterministic package validation.
- Available: Python 3.11, Git, CMake, Ninja, GCC.
- Unavailable: KiCad CLI, AD19, IAR and Keil command entries. A22 source archive is not present.
- Tests: 59 passed, 0 failed.
- Acceptance matrix: 48 PASS, 0 FAIL, 6 BLOCKED, 0 NOT_RUN. Exact case results are in `test_results.json`.
- Candidate: `AI嵌入式全栈工程统一约束包_V6.0.0_RC.zip`
- Candidate SHA-256: `9a097048535d93bb4313f24f44b556c24467d26384398c20b167c8badc15a49d`
- Clean-room evidence: `evidence/R6-clean-room.json`.
- Real host software evidence: `evidence/R3-synthetic/result.json`; this proves only the isolated host GCC fixture, not MCU/RTOS/device behavior.
- Safety boundary: write only in this launch-package directory; no device, destructive, publish, or production actions.
- Remaining blockers: `SW-004` needs A22 input; `HW-002` and `PCB-001..004` need installed native EDA plus editable schematic/PCB fixtures.
- Next safe action after a blocker is removed: rerun `python -m aies probe --project-root . --json`, execute only the matching native adapter workflow, then rerun acceptance and clean-room packaging.
- Regression: from `AI-Embedded-Fullstack-V6`, run `python -m unittest discover -s tests -v` and `python tools/run_acceptance.py`.

The parent repository has unrelated existing changes. Preserve them and scope any future checkpoint to this directory only.
