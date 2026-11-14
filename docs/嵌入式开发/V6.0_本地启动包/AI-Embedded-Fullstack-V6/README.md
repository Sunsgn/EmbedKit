# AI Embedded Fullstack Engineering System V6.0 RC

AIES is a local-first, platform-neutral engineering automation runtime for project discovery, scoped rule routing, controlled execution, evidence validation, recovery, and truthful delivery grading. It does not assume a particular MCU, RTOS, IDE, EDA tool, or operating system.

AI agents must read [`AGENTS.md`](AGENTS.md) first. It is the single unified AI constraint entry; `rules/*/rules.json` provides its executable rule registry.

Quick check from this directory:

```powershell
python -m aies --help
python -m aies probe --project-root . --json
python -m unittest discover -s tests -v
```

Side-effecting generic execution is intentionally unavailable. Typed adapters validate paths and authorization, record raw evidence, and never promote missing EDA/device/approval evidence to PASS. The current host policy is reported as `POLICY_ONLY` because a Python process cannot prevent all alternative host filesystem or shell access.

See `QUICKSTART.md` for commands and `docs/CAPABILITY_BOUNDARIES.md` for verification limits.
