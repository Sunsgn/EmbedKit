# 原子约束规则

> 本文件由同目录 `rules.json` 确定性生成，供 AI 按需读取；修改规则时应修改 JSON 后重新生成。

- Schema：`1.1`
- 规则数量：6

## SEC-THREAT-001 — security_release

- 版本：`1.0`
- 触发：new_external_interface, security_review
- 适用条件：an asset crosses a trust boundary
- 必需输入：
  - assets
  - entry points
  - trust boundaries
  - attacker assumptions
- 强制动作：
  1. enumerate threats and abuse cases
  2. map mitigations and verification
  3. record residual risk and owner
- 必需证据：
  - threat model
  - security test mapping
- 通过条件（全部满足）：
  - every external entry and protected asset is covered
  - high residual risk has explicit responsible acceptance
  - mitigation has verifiable test
- 失败动作：block security approval for uncovered high risk
- 关联验收：TEST-001

## SEC-INPUT-001 — security_release

- 版本：`1.0`
- 触发：untrusted_input, remote_command
- 适用条件：data or commands cross a trust boundary
- 必需输入：
  - authentication/authorization policy
  - format/size/rate limits
- 强制动作：
  1. authenticate and authorize before privileged action
  2. validate canonical format length range and freshness
  3. rate-limit and audit failures
- 必需证据：
  - negative authorization/parser tests
  - audit event
- 通过条件（全部满足）：
  - unauthenticated unauthorized replayed oversized and malformed requests are rejected
  - failure cannot invoke partial privileged side effect
  - logs omit secrets
- 失败动作：default deny and preserve bounded diagnostic
- 关联验收：CORE-018, CORE-020

## SEC-KEY-001 — security_release

- 版本：`1.0`
- 触发：key, certificate, secret
- 适用条件：sensitive credential is created stored or used
- 必需输入：
  - credential purpose
  - trust owner
  - lifecycle and storage capability
- 强制动作：
  1. use approved generation/storage API
  2. define provisioning rotation revocation destruction
  3. redact logs and exports
- 必需证据：
  - capability proof
  - lifecycle record without secret value
- 通过条件（全部满足）：
  - no production secret is hardcoded committed or logged
  - private material is accessible only to required principal
  - revocation/rotation path exists
- 失败动作：stop release and treat exposure according to incident process
- 关联验收：MFG-REL-001

## SYS-SAFE-001 — security_release

- 版本：`1.1`
- 触发：safety_critical_change
- 适用条件：failure can cause unsafe physical behavior
- 必需输入：
  - hazard
  - safe state
  - timing limit
  - independent protection
  - approval owner
- 强制动作：
  1. define local fail-safe behavior
  2. analyze reset disconnect stuck and corrupt input
  3. execute fault injection
  4. separate candidate test and approval levels
- 必需证据：
  - safety contract
  - fault timing result
  - external approval when required
- 通过条件（全部满足）：
  - each identified single fault reaches/maintains defined safe state within project limit
  - network/cloud is not required for local safety
  - unverified fault remains NOT_RUN/BLOCKED
- 失败动作：stop physical/release action and continue isolated analysis only
- 关联验收：CORE-008, TEST-001

## REL-PACK-001 — security_release

- 版本：`1.0`
- 触发：release_candidate
- 适用条件：deliverables are packaged
- 必需输入：
  - source/build/dependency baseline
  - hardware and configuration tuple
  - test results
  - SBOM/licenses
- 强制动作：
  1. build immutable manifest
  2. scan debug/test credentials and known vulnerabilities
  3. verify package from clean extraction
  4. sign only through authorized service
- 必需证据：
  - manifest/hashes
  - clean-room report
  - scan results
  - approval
- 通过条件（全部满足）：
  - manifest exactly matches package contents
  - clean extraction reproduces mandatory checks
  - BLOCKED/NOT_RUN items remain visible
  - signature identity is verified
- 失败动作：retain RC status and do not publish
- 关联验收：PACK-001, PACK-002, PACK-003

## REL-FIELD-001 — security_release

- 版本：`1.0`
- 触发：field_update, remote_maintenance
- 适用条件：deployed product is changed or diagnosed
- 必需输入：
  - target identity
  - current/target compatibility
  - backup/rollback
  - authorization
- 强制动作：
  1. verify target and preconditions
  2. create recoverable checkpoint
  3. execute bounded update
  4. verify health or rollback
  5. audit outcome
- 必需证据：
  - target/version log
  - update and rollback result
- 通过条件（全部满足）：
  - wrong target/incompatible version is rejected
  - power/interruption leaves recoverable state
  - failure cannot silently remain partially applied
- 失败动作：isolate target restore last verified state and report
- 关联验收：CORE-024
