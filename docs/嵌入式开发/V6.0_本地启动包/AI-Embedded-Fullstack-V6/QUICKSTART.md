# Quick start

All project paths must already exist. Read-only commands do not create `.aies` state.

For AI development constraints, place this package at `<project>/.ai/AIES-V6` and copy `templates/PROJECT_AGENTS.md` to `<project>/AGENTS.md`. On each task, the AI reads only the route output's `ai_read_files`; it must not preload all domain rules or machine JSON.

```powershell
python -m aies inspect --project-root D:\work\demo --read-only --json
python -m aies route --project-root D:\work\demo --task "修复 UART DMA 接收" --json
python -m aies init --project-root D:\work\demo --mode auto
python -m aies plan --project-root D:\work\demo --task "修复 UART DMA 接收" --json
python -m aies status --project-root D:\work\demo --json
python -m aies resume --project-root D:\work\demo --task-id ID --dry-run --json
python -m aies verify --project-root D:\work\demo --task-id ID --json
python -m aies audit --project-root D:\work\demo --benchmark --json
```

Exit codes: `0` verified command success, `2` contract error, `3` capability unavailable, `4` authorization required, `5` input conflict or blocked verification, `70` program/system error.

`run` defaults to dry-run. There is no shell-string execution interface. Device flashing, deletion, Git mutation, manufacturing release, and approval require independently scoped authority and a typed adapter; unsupported operations remain blocked.
