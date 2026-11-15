# 原子约束规则

> 本文件由同目录 `rules.json` 确定性生成，供 AI 按需读取；修改规则时应修改 JSON 后重新生成。

- Schema：`1.1`
- 规则数量：6

## OPS-AUTH-001 — core

- 版本：`1.1`
- 触发：side_effect
- 适用条件：action changes files, Git, devices, EDA, production or external systems
- 必需输入：
  - typed action
  - resolved target
  - authorization artifact
- 强制动作：
  1. resolve canonical target
  2. match action and target to authorization
  3. verify expiry nonce and signature
  4. journal allow or deny
- 必需证据：
  - authorization decision
  - journal event
- 通过条件（全部满足）：
  - read-only actions need no mutation authority
  - every side effect is within exact authorized scope
  - invalid or absent authority is denied
- 失败动作：block only the affected action and continue independent read-only work
- 关联验收：CORE-022, CORE-023, CORE-024

## OPS-PATH-001 — core

- 版本：`1.0`
- 触发：file_write, move, delete
- 适用条件：a filesystem target may change
- 必需输入：
  - authorized root
  - literal target path
  - operation kind
- 强制动作：
  1. resolve root and target without shell expansion
  2. reject traversal links and broad roots
  3. check dirty overlap and exact object list
- 必需证据：
  - resolved paths
  - pre-operation hashes
  - scope decision
- 通过条件（全部满足）：
  - target is a descendant of authorized root
  - target is not home drive root or workspace root for recursive destructive action
  - pre-existing dirty overlap is zero
- 失败动作：do not write; report exact unsafe target and preserved state
- 关联验收：CORE-010, CORE-014, CORE-022

## OPS-BASE-001 — core

- 版本：`1.0`
- 触发：task_start, resume
- 适用条件：any task establishes or restores a baseline
- 必需输入：
  - package version
  - project constraints
  - Git/file state
  - tool versions
- 强制动作：
  1. hash authoritative inputs
  2. record HEAD and dirty files
  3. record capabilities and project facts
  4. classify conflicts
- 必需证据：
  - inputs lock
  - fact provenance
  - dirty-file snapshot
- 通过条件（全部满足）：
  - every locked input has path version and SHA-256
  - conflicting facts remain CONFLICT
  - no project-specific fact becomes a global default
- 失败动作：enter NEEDS_REVIEW for changed or conflicting inputs
- 关联验收：CORE-001, CORE-011, CORE-013, CORE-027

## OPS-EVID-001 — core

- 版本：`1.1`
- 触发：pass_claim, task_completion
- 适用条件：a result is promoted to PASS or COMPLETED
- 必需输入：
  - completion contract
  - current input identities
  - artifact hashes
  - tool result
- 强制动作：
  1. verify artifact existence and hash
  2. verify tool target exit code and declared outputs
  3. evaluate every required check
  4. preserve non-PASS results
- 必需证据：
  - validator output
  - raw artifacts
- 通过条件（全部满足）：
  - PASS has at least one matching current artifact
  - tool verification has exit code zero and every declared output
  - COMPLETED has all required checks evidence-valid
- 失败动作：reject promotion and retain FAIL BLOCKED or NOT_RUN
- 关联验收：CORE-017, CORE-018, CORE-019, CORE-020, CORE-021

## OPS-REC-001 — core

- 版本：`1.0`
- 触发：process_restart, resume
- 适用条件：journal contains prior operations
- 必需输入：
  - journal
  - input lock
  - current workspace hashes
- 强制动作：
  1. skip completed operation IDs
  2. retry only idempotent failed operations
  3. classify uncertain non-idempotent operations
  4. revalidate inputs before continuation
- 必需证据：
  - recovery diagnostic
  - before/after state
- 通过条件（全部满足）：
  - completed side effect is not replayed
  - uncertain flash delete overwrite commit or production action becomes NEEDS_REVIEW
  - changed input blocks dangerous continuation
- 失败动作：stop affected branch and expose safe next action
- 关联验收：CORE-026, CORE-027, CORE-028

## OPS-LIMIT-001 — core

- 版本：`1.0`
- 触发：scan, long_task, log_capture
- 适用条件：resource consumption can grow with input
- 必需输入：
  - declared file/count/byte/time limits
- 强制动作：
  1. enforce limit
  2. support cancellation and timeout
  3. record covered and omitted scope
- 必需证据：
  - limit configuration
  - termination status
- 通过条件（全部满足）：
  - no unbounded scan log retry or task
  - limit termination is not reported as complete coverage
  - resources are released on stop
- 失败动作：return PARTIAL or BLOCKED with measured coverage
- 关联验收：PERF-001, PERF-002, PERF-003
