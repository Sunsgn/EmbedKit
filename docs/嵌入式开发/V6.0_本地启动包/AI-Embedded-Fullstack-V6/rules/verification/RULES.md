# 原子约束规则

> 本文件由同目录 `rules.json` 确定性生成，供 AI 按需读取；修改规则时应修改 JSON 后重新生成。

- Schema：`1.1`
- 规则数量：6

## VER-CONTRACT-001 — verification

- 版本：`1.0`
- 触发：test_case
- 适用条件：a test is defined or executed
- 必需输入：
  - requirement/risk
  - object version
  - precondition
  - stimulus
  - measurement threshold unit tolerance
  - timeout and cleanup
- 强制动作：
  1. validate contract completeness
  2. bind target/tool/environment
  3. execute exact steps
  4. capture raw result
- 必需证据：
  - test contract
  - raw measurement/log
  - input identity
- 通过条件（全部满足）：
  - threshold and unit are defined before execution
  - actual target/version matches contract
  - PASS result meets every stated expected condition
- 失败动作：incomplete contract is NOT_RUN not PASS
- 关联验收：TEST-001

## VER-NEG-001 — verification

- 版本：`1.0`
- 触发：parser, interface, state_machine, recovery
- 适用条件：failure behavior is part of the contract
- 必需输入：
  - invalid/boundary/fault classes
  - safe outcome
- 强制动作：
  1. test empty minimum maximum oversized corrupt timeout duplicate concurrent cancel and restart cases as applicable
  2. verify recovery after each fault
- 必需证据：
  - negative vectors
  - before/fault/after state
- 通过条件（全部满足）：
  - invalid input is rejected without corruption or hang
  - resource is released after cancel/timeout
  - subsequent valid operation succeeds or documented safe state persists
- 失败动作：retain minimal failing vector and block affected check
- 关联验收：CORE-017, CORE-021

## VER-SIM-001 — verification

- 版本：`1.0`
- 触发：simulation, mock, HIL
- 适用条件：a substitute environment is used
- 必需输入：
  - model/stub scope and version
  - differences from target
- 强制动作：
  1. label evidence level
  2. list modeled and omitted behaviors
  3. prevent promotion beyond verified layer
- 必需证据：
  - model identity
  - scope statement
  - execution log
- 通过条件（全部满足）：
  - simulation result is never labeled physical target PASS
  - omitted timing electrical RF thermal and safety behavior remains unverified
  - HIL target identities are recorded
- 失败动作：downgrade claim to actual evidence level
- 关联验收：SW-001, HW-002

## VER-REAL-001 — verification

- 版本：`1.0`
- 触发：device_test, measurement
- 适用条件：physical target or instrument evidence is claimed
- 必需输入：
  - device/hardware/firmware identity
  - instrument and calibration
  - connection/environment
- 强制动作：
  1. verify identities
  2. record stimulus and raw sample
  3. apply threshold calculation
  4. preserve timestamped evidence
- 必需证据：
  - device and instrument metadata
  - raw readings
  - result calculation
- 通过条件（全部满足）：
  - device and firmware match requested target
  - instrument calibration is valid for measurement
  - raw reading reproducibly supports result
- 失败动作：mark BLOCKED or FAIL; do not substitute simulation
- 关联验收：HW-002, PCB-003

## VER-DEFECT-001 — verification

- 版本：`1.0`
- 触发：bug_fix
- 适用条件：a defect is corrected
- 必需输入：
  - minimal reproduction
  - expected/actual
  - affected versions
- 强制动作：
  1. run reproduction before fix
  2. implement targeted change
  3. rerun reproduction
  4. run affected regression
- 必需证据：
  - pre-fix failure
  - diff
  - post-fix pass
  - regression log
- 通过条件（全部满足）：
  - same reproduction fails before and passes after fix
  - failure test is retained
  - no required affected regression fails
- 失败动作：defect remains open with current diagnosis
- 关联验收：SW-003

## VER-REPORT-001 — verification

- 版本：`1.0`
- 触发：test_summary, release_report
- 适用条件：individual results are aggregated
- 必需输入：
  - all applicable case results
  - evidence paths
- 强制动作：
  1. retain PASS FAIL BLOCKED NOT_RUN and NOT_APPLICABLE separately
  2. verify evidence links
  3. list exclusions and coverage
- 必需证据：
  - case-level result set
  - summary calculation
- 通过条件（全部满足）：
  - summary counts equal case set
  - non-PASS is not hidden by pass rate
  - NOT_APPLICABLE has reason and owner
- 失败动作：reject misleading report and regenerate from source results
- 关联验收：PACK-003
