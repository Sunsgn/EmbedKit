# 原子约束规则

> 本文件由同目录 `rules.json` 确定性生成，供 AI 按需读取；修改规则时应修改 JSON 后重新生成。

- Schema：`1.1`
- 规则数量：6

## PCB-IN-001 — pcb

- 版本：`1.0`
- 触发：pcb_start, netlist_change
- 适用条件：PCB work begins or schematic connectivity changes
- 必需输入：
  - approved netlist
  - board outline and mechanics
  - BOM/footprints
  - native PCB revision
- 强制动作：
  1. compare references pins nets and footprints
  2. verify board outline holes keepouts and origin
  3. record source revisions
- 必需证据：
  - netlist comparison
  - object counts
  - input hashes
- 通过条件（全部满足）：
  - reference pin and net sets match authoritative schematic
  - every placed footprint maps to approved part
  - mechanical revision is identified
- 失败动作：stop layout/routing on any unexplained mismatch
- 关联验收：PCB-001

## PCB-RULE-001 — pcb

- 版本：`1.0`
- 触发：stackup, netclass, design_rule
- 适用条件：physical constraints are defined or changed
- 必需输入：
  - fabricator limits
  - stackup/material/copper
  - current temperature rise impedance and safety inputs
- 强制动作：
  1. derive widths gaps vias differential and safety classes
  2. record equation unit source and margin
  3. map every critical net to a class
- 必需证据：
  - rule derivation table
  - fabricator source
  - class assignment
- 通过条件（全部满足）：
  - no critical net uses an unexplained default rule
  - calculated requirement is no weaker than configured rule
  - unknown material or safety input blocks corresponding claim
- 失败动作：remain PLAN_ONLY until inputs are verified
- 关联验收：PCB-005

## PCB-PLACE-001 — pcb

- 版本：`1.0`
- 触发：placement
- 适用条件：components are placed or moved
- 必需输入：
  - mechanical constraints
  - functional groups
  - datasheet placement requirements
- 强制动作：
  1. lock connectors holes antenna sensor and isolation boundaries
  2. place power clock analog and decoupling by critical loops
  3. check courtyard height orientation access and testability
- 必需证据：
  - native placement
  - constraint checks
  - critical-component review
- 通过条件（全部满足）：
  - no mechanical keepout/courtyard violation
  - decoupling and critical loops satisfy component-source constraints
  - programming production and required test access remain available
- 失败动作：do not begin dependent routing for unresolved critical placement
- 关联验收：PCB-002

## PCB-ROUTE-001 — pcb

- 版本：`1.0`
- 触发：routing, copper
- 适用条件：tracks vias zones or planes change
- 必需输入：
  - net classes
  - return-path and topology requirements
  - current/impedance targets
- 强制动作：
  1. route critical nets by priority
  2. maintain continuous return path
  3. verify power loop neckdown vias and copper
  4. refill zones and check islands
- 必需证据：
  - native routed board
  - unrouted count
  - critical-net inspection
- 通过条件（全部满足）：
  - required unrouted count is zero
  - no critical signal crosses a reference discontinuity without reviewed return path
  - power copper meets derived current/thermal rule
- 失败动作：report ROUTED only when criteria are met; otherwise EDITABLE_LAYOUT or PLAN_ONLY
- 关联验收：PCB-002, PCB-003

## PCB-DRC-001 — pcb

- 版本：`1.0`
- 触发：DRC, pcb_change
- 适用条件：a PCB candidate is evaluated
- 必需输入：
  - native board
  - actual EDA/version
  - approved rule set
- 强制动作：
  1. run actual DRC
  2. bind violation to rule net and coordinate
  3. fix and rerun
  4. reopen board after save
- 必需证据：
  - raw DRC report and hash
  - waivers
  - reopen verification
- 通过条件（全部满足）：
  - mandatory DRC error count is zero
  - each remaining warning/waiver has owner reason scope and revision
  - report input hash matches current board
- 失败动作：DRC failure blocks fabrication claim; missing tool is NOT_RUN
- 关联验收：PCB-003

## PCB-FAB-001 — pcb

- 版本：`1.1`
- 触发：Gerber, drill, PnP, fabrication_output
- 适用条件：manufacturing files are generated
- 必需输入：
  - DRC-verified board revision
  - layer map
  - origin/unit/mirroring conventions
- 强制动作：
  1. generate Gerber drill PnP BOM and assembly outputs
  2. independently view/read back outputs
  3. verify layers holes slots coordinates and versions
  4. hash every file
- 必需证据：
  - output manifest
  - viewer/readback result
  - native board hash
- 通过条件（全部满足）：
  - manifest contains all required outputs and no stale mixed revision
  - layer and drill mapping match current board
  - PnP/BOM references and coordinates reconcile with board
- 失败动作：label FAB_FILES_CHECKED only after readback; generation alone is insufficient
- 关联验收：PCB-004
