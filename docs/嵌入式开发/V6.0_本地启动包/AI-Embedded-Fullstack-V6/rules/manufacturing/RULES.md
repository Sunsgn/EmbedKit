# 原子约束规则

> 本文件由同目录 `rules.json` 确定性生成，供 AI 按需读取；修改规则时应修改 JSON 后重新生成。

- Schema：`1.1`
- 规则数量：6

## MFG-BOM-001 — manufacturing

- 版本：`1.0`
- 触发：BOM, AVL, substitute_part
- 适用条件：manufacturing material identity changes
- 必需输入：
  - hardware revision
  - manufacturer and internal part numbers
  - approved vendors
  - substitution conditions
- 强制动作：
  1. verify exact part/package/spec/lifecycle
  2. compare substitute electrical software calibration regulatory impact
  3. update revision and compatibility
- 必需证据：
  - versioned BOM
  - approval and comparison
- 通过条件（全部满足）：
  - each fitted reference resolves to one approved orderable part
  - substitute is verified across all affected constraints
  - mixed unapproved BOM revision is rejected
- 失败动作：hold purchasing/build for unresolved item
- 关联验收：MFG-001

## MFG-DFT-001 — manufacturing

- 版本：`1.0`
- 触发：DFM, DFA, DFT
- 适用条件：design is prepared for manufacture/test
- 必需输入：
  - fabricator/assembler capabilities
  - test coverage targets
  - repair strategy
- 强制动作：
  1. check manufacturability assembly access polarity and inspection
  2. map required nets/functions to test access
  3. identify untestable risks
- 必需证据：
  - DFM/DFA report
  - test-point coverage map
- 通过条件（全部满足）：
  - every mandatory production check has accessible method
  - critical polarity/orientation is inspectable
  - capability exceptions have approved disposition
- 失败动作：block manufacturing readiness claim
- 关联验收：PCB-004

## MFG-FIX-001 — manufacturing

- 版本：`1.0`
- 触发：fixture, production_test
- 适用条件：a product is connected to automated production equipment
- 必需输入：
  - fixture hardware/software version
  - DUT identity
  - safe operating limits
  - self-test
- 强制动作：
  1. verify fixture identity and calibration
  2. run self-test
  3. validate target and connections before stimulus
  4. enforce timeout emergency stop and release
- 必需证据：
  - fixture self-test
  - DUT/fixture version log
  - raw production result
- 通过条件（全部满足）：
  - wrong DUT/fixture combination is rejected
  - stimulus never exceeds verified limit
  - failure/cancel releases DUT and fixture safely
- 失败动作：isolate station and affected units
- 关联验收：TEST-001

## MFG-CAL-001 — manufacturing

- 版本：`1.0`
- 触发：calibration
- 适用条件：unit-specific measurement coefficients are produced
- 必需输入：
  - traceable reference
  - environment
  - algorithm/range
  - schema and product identity
- 强制动作：
  1. record raw reference and DUT readings
  2. calculate coefficients deterministically
  3. validate range
  4. write then read back versioned record
- 必需证据：
  - raw readings
  - calculation
  - write/readback log
  - reference calibration
- 通过条件（全部满足）：
  - coefficient derives from recorded current measurements
  - coefficient and residual error meet project limits
  - stored version length checksum and identity read back exactly
- 失败动作：reject/segregate unit; never insert guessed default production value
- 关联验收：MFG-002

## MFG-TRACE-001 — manufacturing

- 版本：`1.1`
- 触发：production, release_unit
- 适用条件：a unit or batch is accepted
- 必需输入：
  - unit/batch identity
  - hardware/BOM/firmware/boot/calibration/test versions
- 强制动作：
  1. bind complete version tuple
  2. link raw test/calibration results
  3. verify uniqueness and retention
- 必需证据：
  - trace record
  - compatibility result
  - approval source
- 通过条件（全部满足）：
  - every accepted identity has complete compatible tuple
  - duplicate/missing identity is rejected
  - record links to immutable raw results
- 失败动作：quarantine affected unit/batch
- 关联验收：MFG-001, MFG-002

## MFG-REL-001 — manufacturing

- 版本：`1.0`
- 触发：mass_production_release
- 适用条件：production configuration is promoted
- 必需输入：
  - approved design/manufacturing baselines
  - yield/defect status
  - open deviations
  - responsible approval
- 强制动作：
  1. verify all baseline hashes
  2. check deviations/CAPA and compatibility
  3. require external approval
- 必需证据：
  - release checklist
  - baseline manifest
  - approval identity
- 通过条件（全部满足）：
  - no blocking defect/deviation remains
  - all production files share one approved revision tuple
  - approval is externally verifiable
- 失败动作：remain candidate; AI cannot self-release
- 关联验收：PACK-003
