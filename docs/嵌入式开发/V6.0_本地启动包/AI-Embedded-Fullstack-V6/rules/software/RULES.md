# 原子约束规则

> 本文件由同目录 `rules.json` 确定性生成，供 AI 按需读取；修改规则时应修改 JSON 后重新生成。

- Schema：`1.1`
- 规则数量：8

## SW-API-001 — software

- 版本：`1.0`
- 触发：new_api, api_change
- 适用条件：a callable interface is added or changed
- 必需输入：
  - callers
  - execution context
  - data ownership
  - error model
- 强制动作：
  1. define parameter ranges and units
  2. define return errors and timeout
  3. define ownership lifetime thread safety and reentrancy
  4. update callers and tests
- 必需证据：
  - source locations
  - interface tests
  - affected-callers list
- 通过条件（全部满足）：
  - all external inputs are validated before use
  - no ambiguous ownership or ignored mandatory error
  - all affected callers compile and pass regression
- 失败动作：block interface integration until contract is complete
- 关联验收：SW-001, SW-003

## SW-ISR-001 — software

- 版本：`1.0`
- 触发：interrupt, ISR
- 适用条件：code executes in interrupt context
- 必需输入：
  - interrupt source
  - priority model
  - deadline
  - shared objects
- 强制动作：
  1. clear only owned status
  2. capture minimum data
  3. notify task using platform-safe primitive
  4. measure or bound execution time
- 必需证据：
  - ISR source location
  - context-safe API proof
  - timing result or UNKNOWN
- 通过条件（全部满足）：
  - no blocking wait sleep heap allocation formatted logging flash access or protocol parsing in ISR
  - all shared data uses documented synchronization
  - measured or derived WCET is below project deadline
- 失败动作：reject unsafe ISR change; timing without target data remains UNKNOWN
- 关联验收：CORE-003

## SW-DMA-001 — software

- 版本：`1.0`
- 触发：DMA, ring_buffer
- 适用条件：peripheral data is transferred asynchronously
- 必需输入：
  - buffer size source
  - alignment/cache rules
  - producer and consumer
  - overflow policy
- 强制动作：
  1. define ownership and state transitions
  2. handle half/full/idle events
  3. perform bounds and wrap checks
  4. apply cache maintenance when target requires it
- 必需证据：
  - buffer contract
  - overflow and wrap tests
  - target cache rule source
- 通过条件（全部满足）：
  - every read/write index is range-checked
  - producer cannot overwrite unread critical data without declared policy
  - buffer lifetime exceeds active transfer
  - cache behavior is verified or explicitly UNKNOWN
- 失败动作：stop integration on corruption risk; retain raw failing sequence
- 关联验收：CORE-003, SW-003

## SW-CONCUR-001 — software

- 版本：`1.0`
- 触发：RTOS, task, shared_resource
- 适用条件：two contexts can access one state or peripheral
- 必需输入：
  - context list
  - resource owner
  - priority and blocking limits
- 强制动作：
  1. assign single owner or synchronization primitive
  2. define queue capacity and full policy
  3. bound waits and retries
  4. analyze priority inversion
- 必需证据：
  - ownership table
  - queue-full timeout and race tests
- 通过条件（全部满足）：
  - no unprotected shared mutable state
  - no infinite wait busy loop or unbounded retry
  - safety messages have defined priority and loss policy
- 失败动作：block concurrent path and preserve existing working behavior
- 关联验收：CORE-003, TEST-001

## SW-PROTO-001 — software

- 版本：`1.0`
- 触发：protocol, UART, CAN, network
- 适用条件：external bytes are parsed or produced
- 必需输入：
  - authoritative protocol version
  - maximum frame length
  - byte order and units
- 强制动作：
  1. validate header version length command and checksum in order
  2. check remaining length before each field
  3. handle fragmentation concatenation timeout duplicate and unknown extension
  4. encode without native-struct casting
- 必需证据：
  - protocol source
  - valid boundary malformed and recovery vectors
- 通过条件（全部满足）：
  - malformed frame cannot cause out-of-bounds access or permanent parser stall
  - multi-byte fields have explicit endianness sign scale and unit
  - unknown extension follows documented compatibility behavior
- 失败动作：reject frame record bounded diagnostic and reset parser state
- 关联验收：CORE-004, CORE-009

## SW-NVM-001 — software

- 版本：`1.0`
- 触发：NVM, Flash, configuration, calibration
- 适用条件：persistent data is read or written
- 必需输入：
  - schema version
  - length and checksum
  - write endurance
  - migration and defaults
- 强制动作：
  1. validate version length checksum and ranges before use
  2. write only changed content
  3. make update power-loss safe
  4. test old-to-new migration and rollback
- 必需证据：
  - schema
  - corruption power-loss migration tests
  - write-frequency calculation
- 通过条件（全部满足）：
  - invalid data reaches a safe default or explicit error
  - old supported version migrates deterministically
  - no partially written record is accepted
  - estimated writes remain within project endurance budget
- 失败动作：preserve recoverable old data and block release on unhandled version
- 关联验收：MFG-002

## SW-OTA-001 — software

- 版本：`1.0`
- 触发：OTA, Bootloader, firmware_update
- 适用条件：executable image can be replaced
- 必需输入：
  - image identity and signature policy
  - compatibility matrix
  - slot/swap design
  - rollback policy
- 强制动作：
  1. authenticate image before activation
  2. verify target hardware and version
  3. make activation atomic
  4. exercise interrupted update boot failure and rollback
- 必需证据：
  - signed-image result
  - power interruption logs
  - rollback test
- 通过条件（全部满足）：
  - unsigned wrong-target corrupt or disallowed-downgrade image is rejected
  - previous bootable image survives failed activation
  - boot success is confirmed before permanent commit
- 失败动作：remain on or restore last verified image
- 关联验收：TEST-001

## SW-BUILD-001 — software

- 版本：`1.0`
- 触发：software_change, build
- 适用条件：source or build configuration changes
- 必需输入：
  - real build entry
  - target
  - toolchain version
  - completion checks
- 强制动作：
  1. run original non-destructive build
  2. capture complete compiler/linker output
  3. hash new artifacts
  4. run focused then affected regression
  5. parse MAP/ELF when available
- 必需证据：
  - diff
  - command and exit code
  - new artifact hashes
  - test log
  - resource report
- 通过条件（全部满足）：
  - current target build exits zero and all declared artifacts exist
  - required regression passes
  - resource conclusions use current MAP/ELF or remain UNKNOWN
- 失败动作：retain failure and stale artifacts separately; do not claim target success
- 关联验收：SW-001, SW-002, SW-003, SW-005
