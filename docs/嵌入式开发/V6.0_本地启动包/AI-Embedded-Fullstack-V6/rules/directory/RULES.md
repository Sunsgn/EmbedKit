# 原子约束规则

> 本文件由同目录 `rules.json` 确定性生成，供 AI 按需读取；修改规则时应修改 JSON 后重新生成。

- Schema：`1.1`
- 规则数量：6

## DIR-MODE-001 — directory

- 版本：`1.0`
- 触发：directory_task
- 适用条件：project structure is initialized organized extended or audited
- 必需输入：
  - requested mode
  - root inventory
  - V1.20 version/hash
- 强制动作：
  1. classify NEW ORGANIZE EXTEND or AUDIT
  2. reject mismatch between requested and actual state
  3. load no unrelated product lifecycle rules
- 必需证据：
  - mode decision
  - root inventory
- 通过条件（全部满足）：
  - empty project alone may use NEW
  - existing project is not silently migrated
  - ordinary development yields no directory operations
- 失败动作：remain read-only until mode is resolved
- 关联验收：CORE-007, CORE-015, CORE-016

## DIR-NEW-001 — directory

- 版本：`1.0`
- 触发：NEW
- 适用条件：project root is genuinely empty
- 必需输入：
  - framework hash
  - immediate domains
  - preserved items
- 强制动作：
  1. create root AI/readme/ignore/profile entries
  2. create only four core directories and current needed branch
  3. write unknown facts explicitly
- 必需证据：
  - created path list
  - profile
- 通过条件（全部满足）：
  - no optional empty tree or automatic .gitkeep
  - no existing item is overwritten
  - placeholders are not presented as real project facts
- 失败动作：stop before partial initialization on conflict
- 关联验收：CORE-016

## DIR-MAP-001 — directory

- 版本：`1.0`
- 触发：ORGANIZE
- 适用条件：existing materials may move
- 必需输入：
  - full root inventory
  - source boundaries
  - target mapping
- 强制动作：
  1. classify every root item
  2. preserve complete source project boundary
  3. compare same-name hashes
  4. list exact destructive follow-up separately
- 必需证据：
  - source-to-target map
  - conflict list
  - authorization plan
- 通过条件（全部满足）：
  - every inventoried root item has one disposition
  - internal docs/tests/tools/build remain inside source project
  - different-content collision is unresolved not overwritten
- 失败动作：preserve source and pause conflicting branch
- 关联验收：DIR-001

## DIR-INTEG-001 — directory

- 版本：`1.0`
- 触发：migration_copy, move
- 适用条件：material is copied or relocated
- 必需输入：
  - approved mapping
  - source and target roots
- 强制动作：
  1. compare file count total bytes and per-file SHA-256
  2. check links LFS submodules and permissions as applicable
  3. search active old-path references
  4. run original entry from project container
- 必需证据：
  - integrity report
  - reference report
  - build/open/test result
- 通过条件（全部满足）：
  - counts bytes and all required hashes match
  - no unexplained extra/missing file
  - original required entry remains usable or is explicitly unverified
- 失败动作：retain source; never clean after failed verification
- 关联验收：DIR-001

## DIR-CLEAN-001 — directory

- 版本：`1.0`
- 触发：source_cleanup
- 适用条件：original material would be deleted after migration
- 必需输入：
  - passed integrity/function evidence
  - exact cleanup list
  - recovery guarantee
  - separate authorization
- 强制动作：
  1. revalidate no scope change
  2. delete only literal approved targets
  3. rescan root against inventory
- 必需证据：
  - approval
  - cleanup journal
  - final audit
- 通过条件（全部满足）：
  - every target was explicitly authorized
  - recovery exists and prior verification still matches
  - no unplanned root item changed
- 失败动作：do not delete and report retained source
- 关联验收：CORE-022, DIR-001

## DIR-STORE-001 — directory

- 版本：`1.0`
- 触发：large_binary, release_snapshot
- 适用条件：large or immutable artifacts are stored
- 必需输入：
  - size/change rate
  - chosen Git/LFS/external policy
  - restore location
- 强制动作：
  1. apply 10 MiB evaluation and 50 MiB ordinary-Git exclusion thresholds
  2. record version size hash and source
  3. verify LFS/external object retrieval
- 必需证据：
  - storage decision
  - retrieval/hash check
- 通过条件（全部满足）：
  - file at least 50 MiB is not newly committed to ordinary Git history
  - external/LFS object is retrievable and hash-correct
  - editable master and read-only snapshot roles are distinct
- 失败动作：retain local source and block cleanup/publication
- 关联验收：PACK-001
