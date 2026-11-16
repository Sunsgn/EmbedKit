# 任务记录目录

每个实际修改或长任务使用独立目录：

```text
work/<YYYYMMDD>-<专业>-<简短主题>/
├── TASK_PLAN.md
├── STATUS.md
├── INPUT_HASHES.md
├── DECISIONS.md
├── HANDOFF.md
└── evidence/
```

不得直接在`work/`下反复覆盖固定任务文件。任务ID必须稳定、可读且不含密钥或敏感设备标识。原始大日志和二进制证据按项目存储规则放置，任务目录只保存索引、摘要和哈希。
