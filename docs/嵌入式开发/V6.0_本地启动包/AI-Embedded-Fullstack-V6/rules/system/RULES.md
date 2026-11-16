# 原子约束规则

> 本文件由同目录 `rules.json` 确定性生成，供 AI 按需读取；修改规则时应修改 JSON 后重新生成。

- Schema：`1.1`
- 规则数量：6

## SYS-REQ-001 — system

- 版本：`1.0`
- 触发：requirement, new_product
- 适用条件：user intent is converted into engineering work
- 必需输入：
  - source request
  - scope/version
  - stakeholder and operating context
- 强制动作：
  1. assign stable IDs
  2. separate requirement assumption candidate and unknown
  3. define measurable acceptance and failure behavior
- 必需证据：
  - versioned requirement set
  - source links
- 通过条件（全部满足）：
  - each mandatory requirement has unambiguous subject condition and verifiable outcome
  - unknown numeric limit is not invented
  - conflicts remain explicit
- 失败动作：block dependent design decision and request/derive only missing authoritative input
- 关联验收：TEST-001

## SYS-TRACE-001 — system

- 版本：`1.0`
- 触发：requirement_change, verification
- 适用条件：a requirement is implemented or claimed complete
- 必需输入：
  - requirement IDs
  - architecture/interfaces
  - implementation and tests
- 强制动作：
  1. create forward and reverse links
  2. check orphan requirements and unapproved implementation
  3. bind evidence versions
- 必需证据：
  - trace matrix
  - coverage report
- 通过条件（全部满足）：
  - every mandatory requirement links to implementation and current verification
  - every safety-relevant implementation links back to approved requirement
  - orphan count is zero or explicitly dispositioned
- 失败动作：reject completeness claim
- 关联验收：VER-REPORT-001

## SYS-ARCH-001 — system

- 版本：`1.0`
- 触发：architecture, cross_domain_design
- 适用条件：responsibility or data/control flow spans components
- 必需输入：
  - system boundary
  - components
  - interfaces
  - failure/trust boundaries
- 强制动作：
  1. assign single responsibility and owner
  2. define control/data/error flows
  3. analyze coupling fault propagation and recovery
- 必需证据：
  - architecture model
  - interface contracts
  - decision record
- 通过条件（全部满足）：
  - every interface has owner version units timing and error semantics
  - no critical responsibility is duplicated or unowned
  - fault containment and recovery are defined
- 失败动作：hold cross-domain implementation on unresolved interface
- 关联验收：INT-CHANGE-001

## SYS-BUDGET-001 — system

- 版本：`1.0`
- 触发：resource_budget, performance_requirement
- 适用条件：finite system resources are allocated
- 必需输入：
  - total limit
  - component allocations
  - measurement/calculation method
  - margin policy
- 强制动作：
  1. normalize units
  2. sum allocations and overhead
  3. calculate margin
  4. bind verification
- 必需证据：
  - budget table
  - value sources
  - measurement result
- 通过条件（全部满足）：
  - allocations plus overhead and required margin do not exceed verified limit
  - all mandatory contributors are included
  - missing contributor makes budget UNKNOWN
- 失败动作：block capacity/performance claim and identify missing or exceeded contributor
- 关联验收：SW-005, INT-BUDGET-001

## SYS-RISK-001 — system

- 版本：`1.0`
- 触发：hazard, high_impact_change
- 适用条件：failure has product/system consequence
- 必需输入：
  - failure/hazard
  - effect
  - project risk method
  - mitigation owner
- 强制动作：
  1. analyze causes/effects/detection
  2. define prevention/mitigation
  3. link verification and residual acceptance
- 必需证据：
  - risk record
  - mitigation test
  - acceptance source
- 通过条件（全部满足）：
  - every high risk has implemented and verified mitigation
  - residual risk uses project-approved method
  - AI does not self-accept residual risk
- 失败动作：block affected gate or physical action
- 关联验收：SYS-SAFE-001

## SYS-CHANGE-001 — system

- 版本：`1.0`
- 触发：baseline_change, ECO, ECN
- 适用条件：approved behavior/interface/version changes
- 必需输入：
  - before/after baselines
  - affected products and lifecycle stages
  - rollback
- 强制动作：
  1. identify software hardware PCB test manufacturing field impacts
  2. define migration and regression
  3. record approval and effective versions
- 必需证据：
  - change record
  - impact matrix
  - verification and rollback results
- 通过条件（全部满足）：
  - all affected domains have disposition
  - production/field compatibility is explicit
  - rollback or non-reversibility is documented and approved
- 失败动作：keep old baseline effective until change gate passes
- 关联验收：INT-CHANGE-001, MFG-REL-001
