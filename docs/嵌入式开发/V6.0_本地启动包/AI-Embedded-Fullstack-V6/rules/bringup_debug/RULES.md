# 原子约束规则

> 本文件由同目录 `rules.json` 确定性生成，供 AI 按需读取；修改规则时应修改 JSON 后重新生成。

- Schema：`1.1`
- 规则数量：6

## DBG-PWR-001 — bringup_debug

- 版本：`1.0`
- 触发：first_power, board_bringup
- 适用条件：a board revision is powered for initial validation
- 必需输入：
  - approved input range/current limit
  - rail targets
  - board identity
  - safe connection plan
- 强制动作：
  1. inspect and resistance-check unpowered board
  2. configure current-limited source
  3. measure input and rails in sequence
  4. stop on abnormal current/voltage/temperature
- 必需证据：
  - board/revision identity
  - supply settings
  - rail/current measurements
- 通过条件（全部满足）：
  - all powered rails remain within project-approved limits
  - current/temperature show no abnormal condition
  - measurement is bound to exact board
- 失败动作：remove power isolate board and preserve measurements
- 关联验收：HW-PWR-001

## DBG-BOOT-001 — bringup_debug

- 版本：`1.0`
- 触发：boot_failure, reset
- 适用条件：CPU does not reach expected startup state
- 必需输入：
  - power clock reset boot-mode
  - image identity
  - startup symbols
- 强制动作：
  1. verify rails clock and reset before code
  2. verify boot straps/image/vector
  3. capture PC/SP/fault/reset reason
  4. map address using matching ELF/MAP
- 必需证据：
  - waveform/log
  - register snapshot
  - matching artifact hash
- 通过条件（全部满足）：
  - root cause is tied to observed layer and current artifact
  - symbolization uses exact image
  - workaround does not bypass safety/startup requirement
- 失败动作：remain at last verified layer and avoid multi-variable changes
- 关联验收：ART-SYM-001

## DBG-GPIO-001 — bringup_debug

- 版本：`1.0`
- 触发：GPIO, pinmux
- 适用条件：a physical pin is driven or sampled
- 必需输入：
  - schematic net
  - pinmux
  - direction/default/pull
  - external load limits
- 强制动作：
  1. verify mapping and reset state
  2. configure one function
  3. measure level and transition
  4. test conflict and invalid configuration
- 必需证据：
  - mapping
  - measurement
  - source configuration
- 通过条件（全部满足）：
  - measured state matches contract under reset and run
  - no two outputs contend
  - drive/current remains within verified load limit
- 失败动作：return pin to safe/high-impedance state
- 关联验收：INT-MAP-001

## DBG-IRQ-001 — bringup_debug

- 版本：`1.0`
- 触发：interrupt, DMA_debug
- 适用条件：events are missing duplicated delayed or corrupt
- 必需输入：
  - vector/priority
  - status/clear semantics
  - event rate
  - buffer contract
- 强制动作：
  1. count source ISR and consumer events
  2. timestamp latency
  3. verify flag clear and priority
  4. inject overflow/wrap/restart
- 必需证据：
  - event counters
  - latency trace
  - fault/recovery log
- 通过条件（全部满足）：
  - source ISR and consumed counts reconcile under declared policy
  - latency meets project bound
  - overflow and restart recover without stale/corrupt data
- 失败动作：disable affected channel safely and retain counters
- 关联验收：SW-ISR-001, SW-DMA-001

## DBG-BUS-001 — bringup_debug

- 版本：`1.0`
- 触发：I2C, SPI, UART, CAN, bus_debug
- 适用条件：physical bus behavior is validated
- 必需输入：
  - electrical and timing contract
  - controller configuration
  - expected frames
- 强制动作：
  1. measure voltage/timing/termination
  2. capture raw transaction
  3. correlate analyzer and software timestamps
  4. inject timeout/NACK/error/bus-off as applicable
- 必需证据：
  - waveform/capture
  - configuration
  - recovery result
- 通过条件（全部满足）：
  - electrical and timing measurements meet target contract
  - decoded transaction matches raw capture
  - fault recovers within defined policy
- 失败动作：separate electrical/config/protocol cause and block higher-layer claim
- 关联验收：COM-BUS-001, COM-CAN-001

## DBG-REPRO-001 — bringup_debug

- 版本：`1.0`
- 触发：intermittent_fault, runtime_fault
- 适用条件：a defect requires diagnosis
- 必需输入：
  - exact versions
  - observed symptom
  - logs/trace window
  - environment
- 强制动作：
  1. create minimal repeatable stimulus
  2. freeze variables
  3. bisect layer/change
  4. prove cause with controlled reversal
  5. add regression
- 必需证据：
  - minimal reproduction
  - before/after or A/B evidence
  - regression
- 通过条件（全部满足）：
  - same controlled condition reproduces original symptom
  - candidate cause changes outcome predictably
  - fix passes retained reproduction and affected regression
- 失败动作：record hypothesis as unverified and continue evidence collection
- 关联验收：VER-DEFECT-001
