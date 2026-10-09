# EmbedKit Web

EmbedKit 的浏览器工作台，正式部署地址：

<https://sunsgn.github.io/EmbedKit/>

## 本地开发

要求 Node.js 22（Vite 8 至少需要 Node.js 20.19 或 22.12）。

```bash
npm ci
npm run dev
```

前端默认在 `http://localhost:3000/EmbedKit/` 运行。生产构建使用：

```bash
npm run lint
npm run build
npm run preview
```

## GitHub Pages 部署

- Vite 的正式基路径为 `/EmbedKit/`。
- 应用使用哈希路由，刷新子页面不依赖服务器回退规则。
- 推送到 `main` 后，`.github/workflows/deploy.yml` 会检查代码、构建并发布 `frontend/dist`。
- 仓库 Settings → Pages 的 Source 需要选择 **GitHub Actions**。

GitHub Pages 只托管静态前端。教程、静态分析和纯浏览器工具可以直接使用；串口、原始 TCP/UDP、工程文件与本机工具链等能力需要用户在自己的电脑启动 EmbedKit Local Agent。Local Agent 离线时，线上页面必须保留可浏览能力并明确显示离线状态，不能假装已连接设备。
