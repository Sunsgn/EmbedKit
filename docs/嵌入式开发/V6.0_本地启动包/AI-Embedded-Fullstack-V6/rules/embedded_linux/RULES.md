# 原子约束规则

> 本文件由同目录 `rules.json` 确定性生成，供 AI 按需读取；修改规则时应修改 JSON 后重新生成。

- Schema：`1.1`
- 规则数量：6

## LIN-BOOT-001 — embedded_linux

- 版本：`1.0`
- 触发：Linux_boot, bootloader, rootfs
- 适用条件：Linux startup is changed or diagnosed
- 必需输入：
  - boot chain versions
  - partition/media
  - kernel command line
  - current logs
- 强制动作：
  1. identify last verified boot stage
  2. verify image/DTB/rootfs identities
  3. analyze first failing current log
  4. test recovery path
- 必需证据：
  - boot log
  - image manifest
  - stage diagnosis
- 通过条件（全部满足）：
  - conclusion names exact failing stage and current artifacts
  - kernel/rootfs mount reaches contracted state
  - failed update has verified recovery
- 失败动作：preserve last bootable set and stop promotion
- 关联验收：DBG-BOOT-001

## LIN-DT-001 — embedded_linux

- 版本：`1.0`
- 触发：device_tree, DTS, DTB
- 适用条件：hardware description changes
- 必需输入：
  - binding schema
  - schematic/SoC mapping
  - driver requirements
- 强制动作：
  1. validate schema
  2. cross-check reg IRQ clocks resets DMA regulators and pinctrl
  3. compile DTB and inspect warnings
  4. test target probe
- 必需证据：
  - DTS locations
  - schema/compiler output
  - target probe log
- 通过条件（全部满足）：
  - binding validation has no mandatory error
  - resources match authoritative hardware mapping
  - driver probe succeeds or target status remains NOT_RUN
- 失败动作：block target integration on resource conflict
- 关联验收：INT-MAP-001

## LIN-DRV-001 — embedded_linux

- 版本：`1.0`
- 触发：kernel_driver
- 适用条件：kernel module/driver resource lifecycle changes
- 必需输入：
  - kernel API/version
  - resource/locking model
  - power lifecycle
- 强制动作：
  1. audit probe/remove and every error unwind
  2. verify locking and IRQ/work ordering
  3. test open/close suspend/resume unload where supported
- 必需证据：
  - source paths
  - static/build output
  - target lifecycle log
- 通过条件（全部满足）：
  - each acquired resource is released exactly once on every path
  - no sleeping operation occurs in atomic context
  - concurrent access follows documented lock order
- 失败动作：reject driver integration; preserve oops/lockdep evidence
- 关联验收：SW-CONCUR-001

## LIN-ABI-001 — embedded_linux

- 版本：`1.0`
- 触发：ioctl, sysfs, netlink, device_API
- 适用条件：kernel/user ABI is introduced or changed
- 必需输入：
  - ABI version
  - data layout
  - permissions
  - compatibility policy
- 强制动作：
  1. define fixed-width fields and validation
  2. handle 32/64-bit and endianness if applicable
  3. test old/new user space
  4. restrict privilege
- 必需证据：
  - ABI specification
  - compatibility/negative tests
- 通过条件（全部满足）：
  - unknown version/field is handled deterministically
  - user pointers/lengths/ranges are validated
  - stable ABI is not silently broken
- 失败动作：retain old ABI or require explicit migration
- 关联验收：INT-VERS-001

## LIN-SVC-001 — embedded_linux

- 版本：`1.0`
- 触发：service, daemon
- 适用条件：long-running user-space process is deployed
- 必需输入：
  - dependencies
  - user/permissions
  - resource and restart limits
  - shutdown contract
- 强制动作：
  1. run least privilege
  2. configure bounded restart/backoff
  3. handle signals and release resources
  4. rotate/rate-limit logs
- 必需证据：
  - service definition
  - failure/restart/shutdown tests
  - resource observations
- 通过条件（全部满足）：
  - service does not require unnecessary root/capabilities
  - repeated failure cannot create restart storm or unbounded logs
  - stop/restart leaves no orphan resource
- 失败动作：disable service safely and retain diagnostics
- 关联验收：OPS-LIMIT-001

## LIN-UPD-001 — embedded_linux

- 版本：`1.0`
- 触发：system_update, rootfs_update
- 适用条件：Bootloader kernel DTB rootfs or applications are updated
- 必需输入：
  - signed manifest
  - component compatibility
  - atomicity/rollback
  - persistent-data migration
- 强制动作：
  1. verify complete version tuple
  2. stage update without destroying last good set
  3. health-check all required components
  4. rollback on failure/interruption
- 必需证据：
  - update/interrupt/rollback logs
  - manifest/hash
- 通过条件（全部满足）：
  - partial/mixed incompatible component set cannot boot as accepted
  - persistent data survives supported update
  - health failure restores last verified system
- 失败动作：remain/revert to last good slot and block release
- 关联验收：SW-OTA-001, REL-FIELD-001
