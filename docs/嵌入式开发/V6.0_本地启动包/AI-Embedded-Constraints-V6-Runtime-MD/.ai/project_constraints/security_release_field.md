# 当前项目安全、升级、发布与现场维护具体约束

> 本文件记录当前产品的资产、信任边界、危险动作、升级策略、发布批准和现场服务边界。没有产品事实时保持未知，不能把通用安全建议当已实施控制。

## 1. 资产、角色和信任边界

| 资产/接口 | 所有者 | 角色/权限 | 信任边界 | 机密性/完整性要求 | 失效影响 | 依据/状态 |
|---|---|---|---|---|---|---|
| 固件/Bootloader | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |
| 密钥/证书/设备身份 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |
| 调试口/生产口 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |
| 本地通信接口 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |
| 网络/云/远程服务 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |
| 配置/校准/日志 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |

- 每个可写接口必须明确鉴权、授权、重放保护、速率限制、审计和撤销方式。
- 测试凭据、默认口令和开发证书不得进入发布配置；日志不得记录完整密钥、令牌或敏感配置。

## 2. 危险输出和安全状态

| 对象/输出 | 危险 | 安全默认态 | 允许动作条件 | 联锁/独立保护 | 最大持续时间/限值 | 失联/复位状态 | 权威来源 |
|---|---|---|---|---|---|---|---|
| UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |

- 燃气、高压、加热、电机、阀、继电器和大电流输出必须逐项填写；未知任何关键字段时禁止 AI 操作真实设备。
- 软件保护不能替代需求规定的独立硬件保护。安全相关阈值、时间和极性不得用经验值。

## 3. Bootloader、分区和镜像合同

| 项目 | 当前具体值 | 状态 | 来源/版本 | 验证方式 |
|---|---|---|---|---|
| Bootloader 版本/入口 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 分区/槽位及边界 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 产品/板卡兼容字段 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 镜像格式/长度/哈希 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 签名/信任根/算法 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 防降级策略 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 首启健康检查/确认 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 回退/恢复入口 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |

地址和兼容范围没有当前分区及硬件依据时禁止写入。CRC 只能证明传输完整性，不能自动视为来源认证。

## 4. 升级流程与失败矩阵

| 阶段 | 输入/前置 | 超时/重试 | 持久状态 | 任意点掉电后结果 | 恢复/回退 | 证据 |
|---|---|---|---|---|---|---|
| 获取/接收 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 验证 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 写入 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 激活/首启 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 确认/回退 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

必须覆盖损坏、截断、错误产品/硬件、空间不足、写入中断、首启失败、确认前复位、重复包和回退。状态未知的升级写入不得自动重放。

## 5. 构建签名和正式发布命令

| 动作 | 工作目录 | 精确命令/系统 | 输入身份 | 输出及哈希 | 凭据边界 | 批准人/门禁 | 状态 |
|---|---|---|---|---|---|---|---|
| Release 构建 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | NOT_RUN |
| 签名/封装 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | NOT_RUN |
| 发布候选验证 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | NOT_RUN |
| 正式发布 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 需明确授权 | BLOCKED |

- AI 可以准备候选和校验清单，但不得因为测试通过自行批准签名、生产、推送或发布。
- 正式产物必须能追溯源码基线、锁定依赖、工具版本、配置、SBOM/清单和签名结果。

## 6. 现场安装和服务边界

| 服务动作 | 允许角色 | 目标识别 | 前置检查 | 可改范围 | 超时/取消 | 回滚/恢复 | 审计 |
|---|---|---|---|---|---|---|---|
| 安装/配置 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 诊断/日志导出 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 远程命令 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 现场升级 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 维修/部件更换 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

- 远程或现场工具必须显示当前设备、站点、固件和动作，防止作用于错误对象。
- 连接中断后必须区分未开始、已完成和状态未知；状态未知的非幂等写入先查询设备事实，不得盲目重试。

## 7. 诊断、日志、隐私和资源上限

| 数据 | 采集条件 | 必需字段 | 脱敏 | 大小/轮转/频率 | 导出格式 | 保留期限 | 权限 |
|---|---|---|---|---|---|---|---|
| 运行日志 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 崩溃/复位记录 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 通信原始数据 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 现场配置 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

日志风暴不能挤占实时业务、Flash 寿命或通信带宽；“未发现错误”与“缺少数据无法判断”必须区分。

## 8. RMA 和根因闭环

| 阶段 | 当前流程/位置 | 必需输入 | 输出 | 责任人 | 状态 |
|---|---|---|---|---|---|
| 接收与身份核对 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 现场数据保全 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 复现和隔离 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 根因/纠正措施 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 回归/批次影响 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

返修不得先刷机、清日志或恢复默认而破坏原始证据；确需操作时先完成可用证据导出并记录哈希。

## 9. 安全和发布放行门禁

| 门禁 | 具体要求 | 证据 | 批准角色 | 状态 |
|---|---|---|---|---|
| 威胁与接口审查 | UNKNOWN | UNKNOWN | UNKNOWN | NOT_RUN |
| 凭据和调试口处理 | UNKNOWN | UNKNOWN | UNKNOWN | NOT_RUN |
| 升级失败/回退测试 | UNKNOWN | UNKNOWN | UNKNOWN | NOT_RUN |
| 危险输出安全测试 | UNKNOWN | UNKNOWN | UNKNOWN | NOT_RUN |
| 发布候选可复现性 | UNKNOWN | UNKNOWN | UNKNOWN | NOT_RUN |
| 正式发布批准 | UNKNOWN | UNKNOWN | UNKNOWN | BLOCKED |

## 10. 未决项

| ID | 未知/冲突 | 影响 | 所需确认 | 状态 |
|---|---|---|---|---|
| SEC-PROJ-001 | 安全、升级、发布与现场约束尚未初始化 | 禁止高风险和正式发布动作 | 完成资产、升级和授权识别 | OPEN |
