# 原子约束规则

> 本文件由同目录 `rules.json` 确定性生成，供 AI 按需读取；修改规则时应修改 JSON 后重新生成。

- Schema：`1.1`
- 规则数量：6

## ART-TOOL-001 — build_artifacts

- 版本：`1.0`
- 触发：build_project, toolchain
- 适用条件：an existing build target is identified/executed
- 必需输入：
  - project/configuration
  - tool executable/version/license
  - source and environment
- 强制动作：
  1. discover original entry and target
  2. probe tool/version/license
  3. capture source/include/define/link inputs
  4. run typed command
- 必需证据：
  - probe
  - command/cwd
  - complete log
- 通过条件（全部满足）：
  - executed tool/config exactly match requested target
  - all required inputs are resolved
  - missing proprietary tool is UNAVAILABLE not substituted PASS
- 失败动作：continue static inspection and block target-build claim
- 关联验收：SW-001, SW-002

## ART-OUT-001 — build_artifacts

- 版本：`1.0`
- 触发：build_result
- 适用条件：tool execution claims a generated artifact
- 必需输入：
  - expected artifact types/paths
  - pre-build metadata
  - target identity
- 强制动作：
  1. verify exit code
  2. verify each output exists and is newly produced
  3. hash and inspect identity
- 必需证据：
  - pre/post metadata
  - manifest
  - hashes
- 通过条件（全部满足）：
  - exit code is zero
  - every mandatory output exists and differs from stale state as expected
  - artifact target/config identity is correct
- 失败动作：reject TOOL_VERIFIED status and retain log/stale outputs separately
- 关联验收：CORE-021

## ART-MAP-001 — build_artifacts

- 版本：`1.0`
- 触发：MAP, memory_usage
- 适用条件：linker resource use is analyzed
- 必需输入：
  - toolchain/map format
  - memory regions
  - current MAP
- 强制动作：
  1. select matching parser
  2. sum regions/sections/objects/symbols
  3. detect overflow/overlap and largest contributors
  4. report parser coverage
- 必需证据：
  - MAP hash
  - parsed report
  - format adapter
- 通过条件（全部满足）：
  - calculated totals reconcile with linker summary within exact format rules
  - no allocated section exceeds declared region
  - unknown lines/fields are reported not discarded
- 失败动作：resource status remains UNKNOWN on unsupported format
- 关联验收：SW-005

## ART-FMT-001 — build_artifacts

- 版本：`1.0`
- 触发：Intel_HEX, BIN
- 适用条件：loadable image format is imported/exported
- 必需输入：
  - file
  - address/target metadata
  - size limits
- 强制动作：
  1. validate file size and syntax
  2. verify HEX count/type/address/checksum and overlap
  3. bind BIN to explicit base/address map
  4. export canonical segment manifest
- 必需证据：
  - validation report
  - segment/address manifest
  - file hash
- 通过条件（全部满足）：
  - every HEX record checksum and length is valid
  - segments do not conflict or exceed target range
  - raw BIN address is never guessed
- 失败动作：reject damaged/ambiguous image and preserve original bytes
- 关联验收：PACK-002

## ART-SYM-001 — build_artifacts

- 版本：`1.0`
- 触发：crash_address, symbolize
- 适用条件：runtime address is mapped to source/symbol
- 必需输入：
  - exact ELF/AXF
  - firmware hash/build ID
  - load/relocation address
  - architecture
- 强制动作：
  1. verify artifact identity
  2. normalize address for relocation/thumb/mode as applicable
  3. resolve symbol/source and confidence
  4. show nearby raw map evidence
- 必需证据：
  - artifact identity
  - tool command/output
  - source location
- 通过条件（全部满足）：
  - symbol artifact matches running firmware
  - address normalization rule is explicit
  - unresolved address remains UNKNOWN
- 失败动作：do not present stale-symbol result as root cause
- 关联验收：DBG-BOOT-001

## ART-REPRO-001 — build_artifacts

- 版本：`1.0`
- 触发：reproducible_build, release
- 适用条件：build reproducibility is evaluated
- 必需输入：
  - locked source/dependencies/tools/environment
  - normalization policy
- 强制动作：
  1. build twice in isolated paths
  2. compare manifests and normalized artifacts
  3. explain timestamps/paths/randomness differences
- 必需证据：
  - two build logs/manifests
  - difference report
- 通过条件（全部满足）：
  - functional sections/metadata match under declared policy
  - all differences have traced source
  - claim distinguishes byte-identical from normalized reproducibility
- 失败动作：record non-reproducible cause and block stronger claim
- 关联验收：PACK-001
