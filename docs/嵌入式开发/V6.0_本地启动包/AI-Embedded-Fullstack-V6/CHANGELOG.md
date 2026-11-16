# Changelog

## 6.0.0-rc.1

- Added project discovery with scoped constraints and bounded scanning.
- Added impact-aware task routing, evidence contracts, signed authorization validation, append-only journal primitives, input-lock recovery, and single-writer locks.
- Added real host GCC adapter and synthetic failure/fix/build/runtime slice.
- Added truthful KiCad, AD19, IAR, Keil, HIL capability probing and `POLICY_ONLY` host-isolation disclosure.
- Added interface, error-budget, version compatibility, NVM migration, safety-contract, deterministic package, and package-tamper validators.
- Added `AGENTS.md` as the single unified AI constraint entry, backed by validated executable rule registries.
- Added detailed human-readable constraints for core, software, hardware, PCB, integration, verification, manufacturing, security/release, and directory domains; routing now loads both professional constraints and machine gates.
- Reduced the mandatory AI entry to a compact L0, added a project-root AGENTS template, and separated `ai_read_files` from `machine_rule_files` to prevent full-rule context loading.
- Expanded the nine domain registries to 56 atomic, testable constraints and added deterministic human-readable `RULES.md` generation.
- Added system engineering, board bring-up/debug, build artifacts, embedded Linux, communication, reliability, mechanical/thermal, and extension-ecosystem domains with on-demand routing.
- Expanded every professional domain from summary guidance into executable constraints with fact sources, ordered engineering actions, explicit prohibitions, tool/authorization boundaries, recovery, evidence, acceptance and failure gates; added regression checks against future summary-only rules.
