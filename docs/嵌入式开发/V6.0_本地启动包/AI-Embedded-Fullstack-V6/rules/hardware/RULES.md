# 原子约束规则

> 本文件由同目录 `rules.json` 确定性生成，供 AI 按需读取；修改规则时应修改 JSON 后重新生成。

- Schema：`1.1`
- 规则数量：6

## HW-PART-001 — hardware

- 版本：`1.0`
- 触发：component, BOM
- 适用条件：a part is selected replaced or reviewed
- 必需输入：
  - exact manufacturer part number
  - datasheet revision
  - operating environment
  - lifecycle and package
- 强制动作：
  1. verify ratings pins polarity package and lifecycle
  2. compare approved alternatives
  3. record derating source
- 必需证据：
  - datasheet URL/file hash
  - BOM and library mapping
- 通过条件（全部满足）：
  - symbol pin package pin and datasheet pin agree
  - maximum project stress plus required margin does not exceed applicable rating
  - replacement compatibility is explicitly verified
- 失败动作：mark part unresolved and block manufacture
- 关联验收：MFG-001

## HW-PWR-001 — hardware

- 版本：`1.0`
- 触发：power, regulator
- 适用条件：a rail is created changed or reviewed
- 必需输入：
  - input range
  - load steady and peak
  - efficiency dropout ripple thermal and sequencing limits
- 强制动作：
  1. calculate worst-case current power loss and margin
  2. verify startup shutdown and fault paths
  3. verify protection and reverse-current behavior
- 必需证据：
  - calculation with units
  - datasheet sources
  - measurement plan/result
- 通过条件（全部满足）：
  - worst-case load is within component and source limits with project-approved margin
  - dropout and transient limits hold over stated range
  - thermal conclusion is measured or explicitly unverified
- 失败动作：block design approval when any required limit or source is unknown
- 关联验收：INT-002

## HW-RESET-001 — hardware

- 版本：`1.0`
- 触发：clock, reset, startup
- 适用条件：clock or reset behavior affects boot
- 必需输入：
  - frequency tolerance
  - load/startup specification
  - reset thresholds widths and power sequence
- 强制动作：
  1. verify component values and layout requirements
  2. trace reset sources and default states
  3. define brownout and debug behavior
- 必需证据：
  - datasheet equations
  - startup timing contract
  - test points
- 通过条件（全部满足）：
  - clock network values derive from selected component source
  - minimum reset pulse and voltage sequence meet every connected device
  - unsafe output defaults are defined during reset
- 失败动作：hold hardware/software integration on unknown boot condition
- 关联验收：TEST-001

## HW-IO-001 — hardware

- 版本：`1.0`
- 触发：digital_interface, GPIO, bus
- 适用条件：devices exchange digital signals
- 必需输入：
  - voltage domains
  - input/output limits
  - drive and timing
  - powered-off behavior
- 强制动作：
  1. check VIH VIL VOH VOL and absolute maxima over conditions
  2. select pull/termination/level shift/isolation
  3. check back-power and contention
- 必需证据：
  - interface table
  - datasheet limits
  - timing or signal-integrity evidence
- 通过条件（全部满足）：
  - driver guaranteed output satisfies receiver guaranteed input with stated margin
  - no state violates absolute maximum or causes uncontrolled back-power
  - direction and default level match software contract
- 失败动作：mark interface CONFLICT and block connection release
- 关联验收：INT-001

## HW-ANALOG-001 — hardware

- 版本：`1.0`
- 触发：ADC, sensor, analog
- 适用条件：an analog quantity is measured or conditioned
- 必需输入：
  - signal range
  - source impedance
  - reference
  - accuracy bandwidth noise and protection
- 强制动作：
  1. build worst-case error budget
  2. verify settling and ADC drive requirements
  3. check clipping common-mode and fault current
  4. define calibration inputs
- 必需证据：
  - schematic locations
  - error budget
  - simulation or measurement
- 通过条件（全部满足）：
  - full valid input range remains inside every stage limits
  - total stated worst-case error is within project requirement
  - missing contributor yields UNKNOWN rather than PASS
- 失败动作：block accuracy claim; preserve safe protection review
- 关联验收：INT-002

## HW-ERC-001 — hardware

- 版本：`1.0`
- 触发：schematic, ERC
- 适用条件：native schematic is reviewed or changed
- 必需输入：
  - native project
  - versioned symbol/footprint libraries
  - EDA capability
- 强制动作：
  1. run actual ERC
  2. classify each violation
  3. reopen saved native project
  4. compare network/BOM/pin diff
- 必需证据：
  - native hashes
  - raw ERC report
  - waiver list
  - reopen result
- 通过条件（全部满足）：
  - no unresolved mandatory ERC error
  - every waiver has reason owner scope and revision
  - saved project reopens and retains intended objects
- 失败动作：report NOT_RUN when tool unavailable and block tool-verified claim
- 关联验收：HW-001, HW-002
