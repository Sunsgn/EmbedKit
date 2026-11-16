# 原子约束规则

> 本文件由同目录 `rules.json` 确定性生成，供 AI 按需读取；修改规则时应修改 JSON 后重新生成。

- Schema：`1.1`
- 规则数量：6

## EXT-MAN-001 — extension

- 版本：`1.0`
- 触发：new_adapter, plugin
- 适用条件：an extension is registered
- 必需输入：
  - stable ID/version/provider
  - capabilities/applicability
  - permissions/dependencies/resources
  - schemas/tests
- 强制动作：
  1. validate manifest
  2. reject duplicate/incompatible registration
  3. index declared capabilities
- 必需证据：
  - manifest
  - schema validation
  - compatibility declaration
- 通过条件（全部满足）：
  - all mandatory manifest fields exist
  - capabilities and version ranges are explicit
  - no project-specific path/value becomes universal default
- 失败动作：do not register extension
- 关联验收：PACK-002

## EXT-API-001 — extension

- 版本：`1.0`
- 触发：adapter_implementation
- 适用条件：extension invokes a tool/device/parser
- 必需输入：
  - adapter contract
  - typed actions
  - evidence/output schema
- 强制动作：
  1. implement probe/supports/plan/execute/evidence/verify/rollback
  2. separate dry plan from execute
  3. return structured error/status
- 必需证据：
  - contract tests
  - probe and execution logs
- 通过条件（全部满足）：
  - probe/plan have no prohibited side effect
  - execute rejects untyped/unauthorized action
  - success requires output verification
- 失败动作：disable adapter and preserve core operation
- 关联验收：CORE-021

## EXT-ISO-001 — extension

- 版本：`1.0`
- 触发：plugin_execute
- 适用条件：third-party extension can consume resources or mutate state
- 必需输入：
  - permission/capability set
  - path/network/device scope
  - time/memory/output limits
- 强制动作：
  1. apply least capability
  2. enforce limits/cancel
  3. isolate failure
  4. release resources
- 必需证据：
  - negative permission tests
  - timeout/cancel/resource result
- 通过条件（全部满足）：
  - extension cannot access undeclared target through supported path
  - timeout/cancel terminates and releases resources
  - one extension failure leaves core/others usable
- 失败动作：quarantine extension and report POLICY_ONLY if host mediation incomplete
- 关联验收：CORE-025

## EXT-COMP-001 — extension

- 版本：`1.0`
- 触发：extension_upgrade, schema_change
- 适用条件：extension/API/data version changes
- 必需输入：
  - old/new versions
  - compatibility matrix
  - migration/rollback
- 强制动作：
  1. test compatible ranges
  2. migrate copy not original
  3. verify and switch
  4. retain rollback
- 必需证据：
  - compatibility tests
  - migration diff/result
- 通过条件（全部满足）：
  - supported old data reads without loss
  - unsupported version is explicit not misparsed
  - failed migration preserves original
- 失败动作：use prior compatible extension or generic fallback
- 关联验收：CORE-028

## EXT-PARSE-001 — extension

- 版本：`1.0`
- 触发：parser, analysis_rule
- 适用条件：extension converts external format into facts
- 必需输入：
  - format/version/signature
  - limits
  - unknown-field policy
  - samples
- 强制动作：
  1. validate signature/version/size
  2. parse bounded input
  3. retain offsets/raw evidence
  4. report coverage/unknown/confidence
- 必需证据：
  - normal/corrupt/unknown/boundary tests
  - source offsets
- 通过条件（全部满足）：
  - malformed input cannot crash/hang or escape limits
  - unknown format is not labeled known
  - each conclusion links raw position and deterministic rule
- 失败动作：preserve raw data and downgrade to generic analysis
- 关联验收：CORE-009

## EXT-REL-001 — extension

- 版本：`1.0`
- 触发：extension_release
- 适用条件：extension is distributed/enabled
- 必需输入：
  - source/binary provenance
  - license/dependencies
  - manifest/tests/compatibility
- 强制动作：
  1. run full extension matrix
  2. scan/package
  3. hash deliverables
  4. document safe degradation
- 必需证据：
  - test report
  - provenance/license
  - package manifest
- 通过条件（全部满足）：
  - all mandatory normal/negative/compatibility tests pass
  - dependencies and license are declared
  - safe degradation works when capability missing
- 失败动作：do not release/enable by default
- 关联验收：REL-PACK-001
