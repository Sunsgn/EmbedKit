# EmbedKit 架构边界

EmbedKit 采用增量演进架构，现有功能通过稳定契约迁移，不以重写替代兼容升级。

## 分层

1. `frontend/src/pages`：路由工作区与交互组合，不实现协议、设备、解析、迁移或报告算法。
2. `frontend/src/application`：用例编排、连接会话、跨模块协作和稳定路由。
3. `frontend/src/features`：可独立测试的领域功能、控制器和界面组件。
4. `frontend/src/services`：浏览器存储、Local Agent 和外部来源适配器。
5. `frontend/src/types`：版本化公共领域模型和证据引用。
6. `contracts`：Web 与 Local Agent 共用的协议版本、能力和路由契约。
7. `proxy/server`：HTTP、安全错误和路由装配；硬件、文件、构建及分析能力应继续迁入独立适配器。

依赖只能由上层指向下层。页面之间不得直接调用组件或复制状态；跨模块协作使用稳定 ID、应用用例和公共模型。

## 新能力接入

新增 Local Agent 能力必须依次完成：

1. 在 `contracts/agent-api.js` 声明能力、路由、方法和超时。
2. 在 `proxy/server` 注册路由，并把系统差异封装到适配器。
3. 在 `frontend/src/application/agent/routes.ts` 暴露安全路径构造器。
4. 通过 `frontend/src/services` 校验结构化响应，页面不得拼接 Agent URL。
5. 补充正常、失败、取消、超时、上限和协议不兼容测试。

新增持久化数据必须先在 `storageRegistry.ts` 登记归属、版本、容量和备份策略。敏感数据、绝对路径、活动硬件会话和大文件默认不得进入便携备份。

## 会话与真实设备

Local Agent 是串口和原始网络连接的资源所有者。前端 `ConnectionSessionManager` 保存跨页面可观察的会话快照，业务模块通过稳定会话 ID 关联测试、固件和证据。浏览器 Web Serial 仍由浏览器适配器管理，迁移到同一接口前不得假装支持后台恢复。

## 迁移约束

`proxy.js` 和大型页面采用绞杀式拆分：新能力只能进入新分层，旧能力逐组迁移，每次迁移保持接口和旧数据兼容并创建独立 Git 检查点。当前优先顺序是测试执行控制器、工程分析控制器、Local Agent 路由组和仓储接口。

架构调整完成的证据不是目录存在，而是对应真实流程仍能执行、失败可定位、数据可恢复、报告可导出，并通过生产构建、GitHub Pages 校验和端到端回归。
