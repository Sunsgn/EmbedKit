# 原子约束规则

> 本文件由同目录 `rules.json` 确定性生成，供 AI 按需读取；修改规则时应修改 JSON 后重新生成。

- Schema：`1.1`
- 规则数量：6

## REL-WDG-001 — reliability

- 版本：`1.0`
- 触发：watchdog, hang_recovery
- 适用条件：watchdog/health monitor is designed or tested
- 必需输入：
  - critical cycle/deadline
  - fault coverage
  - reset/recovery contract
- 强制动作：
  1. feed only after critical work completes
  2. inject task/deadlock/resource faults
  3. record reset cause
  4. verify safe restart and recurrence handling
- 必需证据：
  - feed-path analysis
  - fault/reset/recovery log
- 通过条件（全部满足）：
  - blocked critical work prevents unconditional feed
  - fault is detected within approved bound
  - reset preserves safe outputs and diagnosable cause
- 失败动作：block reliability claim and retain fault evidence
- 关联验收：INT-STATE-001

## REL-PWR-001 — reliability

- 版本：`1.0`
- 触发：brownout, power_cycle, power_interruption
- 适用条件：power quality/interruption can affect state
- 必需输入：
  - approved voltage/time profile
  - critical writes/states
  - safe outputs
- 强制动作：
  1. apply min/max/ramp/dip/cycle cases
  2. monitor reset and outputs
  3. verify persistent data and recovery
- 必需证据：
  - power waveform
  - state/data before and after
- 通过条件（全部满足）：
  - no partially valid persistent record is accepted
  - output remains/reaches safe state
  - restart completes or reports recoverable terminal failure
- 失败动作：isolate corrupt data and block release
- 关联验收：SW-NVM-001

## REL-EMC-001 — reliability

- 版本：`1.0`
- 触发：ESD, EFT, surge, EMC
- 适用条件：electromagnetic immunity/emission is evaluated
- 必需输入：
  - applicable standard/test plan
  - level/setup
  - operating modes and criteria
- 强制动作：
  1. lock sample/version/setup
  2. monitor during stress
  3. classify behavior and recovery
  4. perform post-stress checks
- 必需证据：
  - lab/precheck report
  - setup photos/diagram
  - raw logs
- 通过条件（全部满足）：
  - applied test matches approved plan
  - behavior meets stated criterion in every required mode
  - post-stress safety/data/function checks pass
- 失败动作：stop unsafe test isolate sample and open root-cause regression
- 关联验收：VER-REAL-001

## REL-ENV-001 — reliability

- 版本：`1.0`
- 触发：temperature, humidity, vibration, environment
- 适用条件：environmental range/lifetime is claimed
- 必需输入：
  - approved profile/duration
  - sample/configuration
  - functional criteria
- 强制动作：
  1. condition/monitor samples
  2. exercise worst relevant modes
  3. inspect and function-test after stress
- 必需证据：
  - chamber/profile log
  - sample identities
  - before/during/after results
- 通过条件（全部满足）：
  - actual profile stays within declared tolerance
  - all required functions meet criterion across profile
  - physical damage/parameter drift is dispositioned
- 失败动作：quarantine sample and reject range claim
- 关联验收：MFG-BOM-001

## REL-ENDUR-001 — reliability

- 版本：`1.0`
- 触发：endurance, wear, lifetime
- 适用条件：finite-cycle component/storage is used
- 必需输入：
  - operation frequency/distribution
  - temperature/stress
  - rated endurance
  - required lifetime/margin
- 强制动作：
  1. calculate worst-case cycles/stress
  2. apply wear-leveling/derating where needed
  3. accelerate-test with justified model
- 必需证据：
  - lifetime calculation
  - rating source
  - test/model limits
- 通过条件（全部满足）：
  - calculated usage plus required margin remains within applicable rating
  - model assumptions are explicit
  - missing frequency/stress yields UNKNOWN
- 失败动作：block lifetime claim and reduce/measure usage
- 关联验收：SW-NVM-001

## REL-SOAK-001 — reliability

- 版本：`1.0`
- 触发：soak, stress_test, long_run
- 适用条件：stability over time/load is evaluated
- 必需输入：
  - duration/load profile
  - resource/temperature metrics
  - limits and stop criteria
- 强制动作：
  1. record periodic quantitative metrics
  2. rotate bounded logs
  3. inject planned disturbances
  4. analyze trend and failures
- 必需证据：
  - time series
  - fault list
  - final resource comparison
- 通过条件（全部满足）：
  - no unbounded growth or limit breach
  - all planned disturbances recover
  - test completes declared duration without hidden restart
- 失败动作：FAIL at first contract breach and preserve preceding window
- 关联验收：OPS-LIMIT-001
