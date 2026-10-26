# 依赖安全与升级基线

## 目标

EmbedKit 将浏览器生产依赖、前端开发/发布工具和 Local Agent 分开治理。安全检查不能用破坏性强制升级换取告警清零，也不能把只在构建机出现的风险描述成网页运行时风险。

## 当前基线（2026-10-12）

- 前端生产依赖、完整开发/发布依赖：`npm audit` 均为 0 项已知漏洞。
- Local Agent：生产依赖为 0 项已知漏洞。
- 前端锁文件中的 248 个包均包含许可证声明，共 10 类；生产树 23 个包。
- 生产代码编辑器使用 CodeMirror 6；原 Monaco/DOMPurify 依赖链因上游出现无修复版本的 critical 公告而移除。
- Vite/PostCSS 等共同依赖的 `source-map-js` 覆盖到已修复的 1.2.2。
- `gh-pages` 固定为 6.1.1，避开 6.2.0 以后引入且尚无修复版本的 `braces` 深层嵌套拒绝服务链。GitHub Pages 正式发布仍由 Actions 官方 Pages 工作流完成。

精确可复现版本以 `frontend/package-lock.json` 和 `proxy/package-lock.json` 为准；本文中的数量只是本次基线证据，不是永久通过条件。

## 自动门禁

在 `frontend` 执行：

```text
npm ci
npm run security:check
```

门禁会分别运行生产依赖审计和完整依赖审计：生产依赖不允许 critical/high，moderate 只有在脚本中按 GHSA 明确登记后才允许；开发/发布工具链不允许 critical/high。门禁同时检查锁文件中的许可证声明，并拒绝 AGPL、GPL、SSPL、BUSL 和 Commons Clause。MIT、BSD、0BSD 等已审查宽松许可证可以通过；未知许可证不会被静默接受，缺少声明会直接失败。

在 `proxy` 执行：

```text
npm ci
npm audit --omit=dev --audit-level=high
```

GitHub Pages 工作流会执行以上门禁。审计依赖 npm advisory 服务；网络或审计服务不可用会明确失败，不能被当作“无漏洞”。

## 升级准入

1. 先查看生产与完整审计、直接依赖变更和上游修复范围。
2. 优先采用同一主版本的正常升级；只有上游把安全版本钉死在传递依赖时才使用精确 override。
3. 不运行 `npm audit fix --force`。需要降级或主版本升级时，必须说明影响范围并运行完整回归。
4. 执行 `npm ci` 验证锁文件可复现，再运行领域测试、组件测试、lint、生产构建和 Pages 校验。
5. 新许可证、moderate 例外或仍无上游修复的风险必须单独审查，记录适用入口、攻击前提、临时缓解和复查条件；不能使用包名或动态数量作为宽泛白名单。

## 剩余边界

`npm audit` 只覆盖已进入 npm advisory 数据库的依赖问题，不证明应用没有 XSS、权限越界或供应链风险。EmbedKit 仍需维持 CSP/输入校验、本地权限隔离、GitHub Actions 固定版本、真实工作流测试和定期人工复查。
