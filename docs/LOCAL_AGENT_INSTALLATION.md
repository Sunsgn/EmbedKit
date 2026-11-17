# EmbedKit Local Agent 安装与发布

## 普通用户安装

1. 打开 EmbedKit 网页的“系统 → 本地助手”，确认当前状态。
2. 从该页面直接下载与系统匹配的便携包和同名 `.sha256` 文件；也可进入 GitHub Releases 核对版本、文件大小和发布说明。
3. 校验摘要后解压完整目录。不要在 ZIP 预览窗口内直接运行，也不要只复制启动脚本。Windows 双击 `start-agent.cmd`；Linux/macOS 在终端执行 `./start-agent.sh`。
4. 保持 Agent 窗口运行，回到网页点击“重新检测”。首次访问串口、文件或目录时按系统提示授权。

便携包自带 Node 运行时和对应平台的原生串口依赖，不要求用户安装 Node、npm、Keil、IAR 或编译器。Agent 默认只监听 `127.0.0.1:9999`，退出窗口即停止，不注册系统服务，也不会自动取得文件或设备权限。

Windows 可使用：

```text
Get-FileHash .\embedkit-local-agent-windows-x64.zip -Algorithm SHA256
```

Linux/macOS 可使用：

```text
shasum -a 256 embedkit-local-agent-*.tar.gz
```

结果必须与同名 `.sha256` 文件一致。macOS 首次运行若被 Gatekeeper 拦截，应在系统“隐私与安全性”中显式允许；不要通过关闭系统安全机制绕过。

## 源码启动兜底

发布包尚未覆盖当前平台时，安装 Node.js 22，在 `proxy` 目录执行：

```text
npm ci
npm start
```

这只是兜底路径。网页纯浏览器工具不依赖 Agent，Agent 离线时仍可使用。

## 发布流程

推送 `v*` 标签会触发 `.github/workflows/release-agent.yml`。也可以在 Actions 手工运行该流程，并输入以 `v` 开头的正式版本号；两种方式都会创建带永久下载地址的 GitHub Release。Windows x64、Linux x64、macOS arm64 和 macOS x64 均由对应 GitHub Runner 执行以下流程：

1. `npm ci --omit=dev` 安装锁定的生产依赖，并运行完整 Agent 测试。
2. 复制该 Runner 的官方 Node 22 运行时、Agent 文件和当前平台原生依赖到隔离目录。
3. 用便携包内运行时启动 Agent，通过正式 Pages Origin 和协议头请求 `/api/agent/status`。
4. 只有健康检查返回 `available: true` 才压缩产物并生成 SHA-256。
5. 四个平台全部通过后，把包和摘要附加到指定版本的 GitHub Release。若任一平台缺少资产，网页会保留发布页入口以便定位失败任务。

GitHub Pages 本身只能提供下载入口，不能静默安装本机程序。若直接下载返回 404，应先检查仓库是否已有正式 Release，以及 Release 是否包含对应平台资产；Actions 页面中的临时 Artifact 不是网页正式下载源。

本流程不交叉打包原生串口模块，不从源码临时编译 Node，不把开发依赖、测试日志、缓存、用户配置或 `.embedkit-state` 放入发布包。
