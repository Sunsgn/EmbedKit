# AI Embedded Fullstack Engineering System V6.0 RC

AIES is a local-first constraint system for AI-assisted embedded development. The AI performs engineering work; AIES supplies token-efficient scoped constraints, routing, evidence gates, and recovery rules. It does not assume a particular MCU, RTOS, IDE, EDA tool, or operating system.

AI agents must read [`AGENTS.md`](AGENTS.md) first. It is the unified entry; [`rules/README.md`](rules/README.md) indexes detailed professional `CONSTRAINTS.md` files, and `rules.json` provides executable gates.

Each domain also contains generated `RULES.md` with atomic rules: stable ID, trigger, applicability, required inputs, ordered actions, evidence, all-pass acceptance conditions, and failure policy. Project-specific numeric values must come from the target project rather than global defaults.

For a new project, copy [`templates/PROJECT_AGENTS.md`](templates/PROJECT_AGENTS.md) to the project root as `AGENTS.md`, place this package at `.ai/AIES-V6`, and put project facts in `.ai/PROJECT_PROFILE.md` instead of editing global rules.

Quick check from this directory:

```powershell
python -m aies --help
python -m aies probe --project-root . --json
python -m unittest discover -s tests -v
```

Side-effecting generic execution is intentionally unavailable. Typed adapters validate paths and authorization, record raw evidence, and never promote missing EDA/device/approval evidence to PASS. The current host policy is reported as `POLICY_ONLY` because a Python process cannot prevent all alternative host filesystem or shell access.

See `QUICKSTART.md` for commands and `docs/CAPABILITY_BOUNDARIES.md` for verification limits.
