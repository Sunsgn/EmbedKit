# 原子约束规则

> 本文件由同目录 `rules.json` 确定性生成，供 AI 按需读取；修改规则时应修改 JSON 后重新生成。

- Schema：`1.1`
- 规则数量：6

## INT-MAP-001 — integration

- 版本：`1.0`
- 触发：pinmux, interface_change
- 适用条件：hardware/software endpoint mapping is created or changed
- 必需输入：
  - signal/network
  - hardware pin
  - software peripheral/channel
  - direction voltage default and owner
- 强制动作：
  1. build bidirectional mapping
  2. detect duplicate pin/peripheral/DMA/IRQ use
  3. trace each endpoint to source and test
- 必需证据：
  - interface table
  - conflict report
  - source locations
- 通过条件（全部满足）：
  - every required hardware endpoint has exactly one compatible software owner
  - no resource conflict remains
  - direction voltage and reset default agree on both sides
- 失败动作：mark CONFLICT and block affected integration
- 关联验收：INT-001

## INT-TIME-001 — integration

- 版本：`1.0`
- 触发：startup, shutdown, reset, timing
- 适用条件：events span hardware and software timing
- 必需输入：
  - hardware stable conditions
  - software event sequence
  - deadlines and tolerances
- 强制动作：
  1. construct ordered timing contract
  2. identify asynchronous crossings and races
  3. test min/max and reset interruption
- 必需证据：
  - timing diagram/table
  - measurement or trace
- 通过条件（全部满足）：
  - each software action waits on a verified condition or derived bound
  - all safety deadlines are met by measured/verified result
  - no arbitrary delay is sole synchronization
- 失败动作：timing stays UNKNOWN and blocks safety/reliability claim
- 关联验收：TEST-001

## INT-BUDGET-001 — integration

- 版本：`1.0`
- 触发：power_budget, accuracy_budget, thermal_budget
- 适用条件：multiple contributors determine a system limit
- 必需输入：
  - requirement limit/unit
  - all contributors and worst-case values
  - calculation method
- 强制动作：
  1. normalize units
  2. sum or combine using declared worst-case/statistical method
  3. calculate margin
  4. list missing contributors
- 必需证据：
  - budget table
  - source for every value
- 通过条件（全部满足）：
  - all contributors use compatible units and stated conditions
  - calculated total plus required margin satisfies requirement
  - any missing required contributor yields UNKNOWN
- 失败动作：do not convert incomplete budget to PASS
- 关联验收：INT-002

## INT-STATE-001 — integration

- 版本：`1.0`
- 触发：system_state, fault
- 适用条件：hardware events and software actions form a state machine
- 必需输入：
  - states events guards actions timeouts
  - safe/degraded states
- 强制动作：
  1. enumerate transitions including invalid/unexpected events
  2. define timeout and recovery
  3. trace outputs during reset disconnect and partial failure
- 必需证据：
  - state table
  - fault-injection tests
- 通过条件（全部满足）：
  - every state/event pair has explicit behavior or rejection
  - no fault path leaves actuator/output undefined
  - recovery does not require cloud/network for local safety
- 失败动作：block integration on undefined safety transition
- 关联验收：CORE-008, TEST-001

## INT-VERS-001 — integration

- 版本：`1.0`
- 触发：hardware_version, firmware_version, calibration_version
- 适用条件：independently versioned components must work together
- 必需输入：
  - hardware/BOM
  - firmware/bootloader
  - protocol/NVM/calibration
  - test configuration
- 强制动作：
  1. evaluate exact version tuple
  2. test supported upgrade/downgrade paths
  3. define rejection and fallback
- 必需证据：
  - compatibility matrix
  - migration/rollback results
- 通过条件（全部满足）：
  - only VERIFIED_COMPATIBLE tuple is released
  - unknown or absent tuple is BLOCKED
  - fallback preserves recoverable configuration
- 失败动作：reject mixed version and identify compatible recovery tuple
- 关联验收：MFG-001, MFG-002

## INT-CHANGE-001 — integration

- 版本：`1.0`
- 触发：cross_domain_change
- 适用条件：one professional domain changes a shared contract
- 必需输入：
  - before/after contract
  - consumers
  - production and field versions
- 强制动作：
  1. identify affected domains and artifacts
  2. route required regression
  3. check backward compatibility and migration
- 必需证据：
  - interface diff
  - affected-test list
  - compatibility decision
- 通过条件（全部满足）：
  - every changed field has producer/consumer updates or compatible behavior
  - all mandatory affected tests have evidence
  - field and production impact is recorded
- 失败动作：hold merge/release while any mandatory consumer is unverified
- 关联验收：INT-001
