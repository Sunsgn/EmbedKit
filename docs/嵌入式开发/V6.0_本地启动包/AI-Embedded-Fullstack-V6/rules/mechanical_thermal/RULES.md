# 原子约束规则

> 本文件由同目录 `rules.json` 确定性生成，供 AI 按需读取；修改规则时应修改 JSON 后重新生成。

- Schema：`1.1`
- 规则数量：6

## MEC-IF-001 — mechanical_thermal

- 版本：`1.0`
- 触发：enclosure, mechanical_interface
- 适用条件：PCB/components mate with mechanical parts
- 必需输入：
  - common datum/unit
  - board/mechanical revisions
  - critical features
- 强制动作：
  1. compare outline holes connectors keepouts heights and openings
  2. verify coordinate conversion
  3. run collision/access check
- 必需证据：
  - interface drawing/model
  - difference/collision report
- 通过条件（全部满足）：
  - all critical features use same datum/unit/revision
  - no unresolved collision/keepout violation
  - connect/operate/service access is verified
- 失败动作：block affected layout/enclosure release
- 关联验收：PCB-IN-001

## MEC-TOL-001 — mechanical_thermal

- 版本：`1.0`
- 触发：tolerance, fit
- 适用条件：multiple dimensions determine assembly/clearance
- 必需输入：
  - dimension chain
  - manufacturing tolerances
  - required clearance/compression
- 强制动作：
  1. calculate worst-case stack
  2. identify dominant contributors
  3. validate with representative parts
- 必需证据：
  - tolerance table/calculation
  - fit result
- 通过条件（全部满足）：
  - worst-case stack meets required clearance/compression
  - no tolerance is guessed
  - critical fit has physical or approved process validation
- 失败动作：reject nominal-only fit claim
- 关联验收：MFG-DFT-001

## MEC-THERM-001 — mechanical_thermal

- 版本：`1.0`
- 触发：thermal, temperature_rise
- 适用条件：component/product temperature is evaluated
- 必需输入：
  - losses
  - ambient/range
  - materials/contact/boundaries
  - component limits
- 强制动作：
  1. model all significant heat sources/paths
  2. calculate/simulate worst modes
  3. measure prototype at defined points
  4. correlate model
- 必需证据：
  - model assumptions
  - thermal result
  - measurement/calibration
- 通过条件（全部满足）：
  - measured worst required mode remains within derated project limit
  - model discrepancy is explained
  - missing heat source/boundary makes conclusion UNKNOWN
- 失败动作：block thermal/rating claim and define mitigation/retest
- 关联验收：HW-PWR-001

## MEC-MAT-001 — mechanical_thermal

- 版本：`1.0`
- 触发：material, coating, adhesive
- 适用条件：material affects environment safety or lifetime
- 必需输入：
  - exact material/grade
  - environment
  - process
  - regulatory requirements
- 强制动作：
  1. verify temperature chemical UV moisture flammability and compatibility
  2. assess aging/rework/substitute
  3. record supplier data
- 必需证据：
  - material datasheet/certification
  - compatibility decision
- 通过条件（全部满足）：
  - material identity and applicable ratings are traceable
  - operating/process range fits project profile
  - substitute is not assumed equivalent
- 失败动作：block material approval
- 关联验收：REL-ENV-001

## MEC-SEAL-001 — mechanical_thermal

- 版本：`1.0`
- 触发：IP_rating, seal
- 适用条件：ingress protection is required
- 必需输入：
  - target rating/standard
  - seals/interfaces
  - pressure/vent/environment
- 强制动作：
  1. analyze every ingress path
  2. calculate/verify seal compression
  3. test assembled representative unit
  4. inspect after test
- 必需证据：
  - seal design
  - test setup/result
  - unit identity
- 通过条件（全部满足）：
  - actual test matches required rating method
  - all openings/interfaces are covered
  - post-test internal/function criteria pass
- 失败动作：do not claim IP level; redesign and retest
- 关联验收：REL-ENV-001

## MEC-ASM-001 — mechanical_thermal

- 版本：`1.0`
- 触发：assembly, fastener, wire_harness
- 适用条件：product is assembled or serviced
- 必需输入：
  - assembly order
  - fastener/process specs
  - access and inspection
- 强制动作：
  1. verify sequence/orientation/poka-yoke
  2. define sourced torque/lock/adhesive controls
  3. check harness strain/bend/clearance
  4. perform assembly/rework trial
- 必需证据：
  - work instruction
  - trial/inspection result
- 通过条件（全部满足）：
  - assembly cannot damage or misconnect part under defined process
  - critical process value has source/validation
  - required inspection and service are accessible
- 失败动作：block work instruction/release and preserve trial finding
- 关联验收：MFG-DFT-001
