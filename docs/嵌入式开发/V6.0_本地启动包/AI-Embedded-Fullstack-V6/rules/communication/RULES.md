# 原子约束规则

> 本文件由同目录 `rules.json` 确定性生成，供 AI 按需读取；修改规则时应修改 JSON 后重新生成。

- Schema：`1.1`
- 规则数量：6

## COM-UART-001 — communication

- 版本：`1.1`
- 触发：UART, serial
- 适用条件：asynchronous serial link is implemented/tested
- 必需输入：
  - electrical level
  - peripheral clock and divider equation
  - both endpoint clock tolerances
  - framing/max length F_max
  - peak byte rate R_peak
  - maximum consumer stall T_block
  - flow/idle policy
- 强制动作：
  1. calculate actual baud and local error
  2. combine endpoint tolerances using the documented receiver sampling limit
  3. calculate receive capacity at least ceil(R_peak*T_block)+F_max
  4. process arbitrary receive chunks
  5. inject overflow frame parity and idle errors
  6. recover without stale bytes
- 必需证据：
  - baud and capacity calculations with units and sources
  - receiver-end raw capture
  - split coalesced full-plus-one and recovery tests
- 通过条件（全部满足）：
  - worst relative baud error is within the endpoint or protocol source limit
  - receive capacity covers the declared peak/stall window
  - parser handles every chunk boundary
  - overflow/frame error invalidates the affected frame and produces bounded resynchronization
- 失败动作：reset affected receive frame state preserve raw error counters and keep compatibility UNKNOWN when a tolerance source is missing
- 关联验收：DBG-BUS-001, SW-PROTO-001

## COM-BUS-001 — communication

- 版本：`1.1`
- 触发：I2C, SPI
- 适用条件：synchronous board bus is used
- 必需输入：
  - mode/rate/address or chip-select
  - VDD VOL_max IOL_max tr_max C_bus for I2C
  - tCSS tCSH tSU tH and SCK limits for SPI
  - ownership/timeout
- 强制动作：
  1. calculate I2C R_min=(VDD-VOL_max)/IOL_max and R_max=tr_max/(0.8473*C_bus)
  2. verify the selected pull-up lies in the nonempty interval
  3. verify SPI timing at the receiver
  4. serialize shared access
  5. bound busy/wait
  6. inject NACK arbitration stuck-bus or mode/timing error as applicable
- 必需证据：
  - calculation inputs with units and source pages
  - receiver waveform
  - configuration
  - error/recovery log
- 通过条件（全部满足）：
  - I2C has a nonempty pull-up interval and measured rise time meets the applicable source
  - SPI measured timing meets both devices
  - transaction lifetime/CS and buffers remain valid
  - bus fault exits within timeout and recovers or reports terminal failure
- 失败动作：release or restore bus safely and return explicit error; no feasible I2C interval blocks the selected topology/rate
- 关联验收：DBG-BUS-001

## COM-CAN-001 — communication

- 版本：`1.0`
- 触发：CAN, CAN_FD
- 适用条件：CAN network traffic is produced/consumed
- 必需输入：
  - network type/bit timing
  - IDs/DLC/layout
  - filter/priority
  - bus-off policy
- 强制动作：
  1. validate timing/termination
  2. encode/decode by explicit layout
  3. configure least-required filters
  4. test error passive bus-off and recovery
- 必需证据：
  - CAN capture
  - timing/config
  - fault/recovery trace
- 通过条件（全部满足）：
  - frame ID type DLC endianness scale and unit match contract
  - unexpected frame cannot corrupt state
  - bus-off recovery follows bounded approved policy
- 失败动作：stop transmission when network safety cannot be guaranteed
- 关联验收：CORE-009

## COM-TCP-001 — communication

- 版本：`1.0`
- 触发：TCP, socket, WebSocket
- 适用条件：stream-oriented network session is used
- 必需输入：
  - authorized endpoint
  - framing/TLS
  - timeouts/limits
  - reconnect policy
- 强制动作：
  1. handle partial read/write and backpressure
  2. bound buffers/connections
  3. validate framing and session state
  4. close/reconnect with finite backoff
- 必需证据：
  - network capture
  - state trace
  - disconnect/backpressure tests
- 通过条件（全部满足）：
  - message parser does not assume one recv equals one message
  - connection/buffer count remains within declared limit
  - disconnect and half-close release resources
- 失败动作：close affected session and preserve local safety operation
- 关联验收：OPS-LIMIT-001

## COM-UDP-001 — communication

- 版本：`1.0`
- 触发：UDP, datagram
- 适用条件：connectionless datagrams are used
- 必需输入：
  - authorized bind/peer
  - maximum datagram
  - loss/order/duplicate policy
- 强制动作：
  1. validate source destination and length
  2. detect truncation
  3. apply sequence/idempotency where required
  4. test loss reorder duplicate and burst
- 必需证据：
  - packet capture
  - boundary/fault tests
- 通过条件（全部满足）：
  - oversized/truncated/untrusted datagram is rejected
  - duplicate/old message cannot repeat non-idempotent critical action
  - burst remains within buffer/CPU limit
- 失败动作：drop invalid datagram with rate-limited diagnostic
- 关联验收：SEC-INPUT-001

## COM-STATE-001 — communication

- 版本：`1.0`
- 触发：connectivity, reconnect, heartbeat
- 适用条件：link lifecycle spans multiple states
- 必需输入：
  - states/events/timeouts
  - authentication
  - queue policy
  - local safe behavior
- 强制动作：
  1. centralize transition table
  2. bound retry/backoff/jitter
  3. define queue handling across reconnect
  4. test reset/network flap/auth failure
- 必需证据：
  - state trace
  - soak/fault result
- 通过条件（全部满足）：
  - no infinite tight reconnect or unbounded offline queue
  - each failure reaches defined state
  - local critical behavior continues without link
- 失败动作：enter bounded offline/degraded state
- 关联验收：INT-STATE-001
