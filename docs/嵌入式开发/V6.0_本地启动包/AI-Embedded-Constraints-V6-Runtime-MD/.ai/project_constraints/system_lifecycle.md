# 当前项目系统、需求、合规与生命周期具体约束

> 本文件用于固定当前产品边界、需求依据、系统接口、预算、版本兼容、目标市场、关键物料和生命周期决策，避免 AI 因单个样本自行改变产品模型。

## 1. 产品身份、范围和非目标

| 项目 | 当前具体值 | 状态 | 来源/版本 | 适用范围 |
|---|---|---|---|---|
| 产品/项目名称 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 产品用途和用户 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 目标环境/安装条件 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 本次交付范围 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 明确非目标 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 产品/板卡/软件变体 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |
| 需求基线和变更流程 | UNKNOWN | UNKNOWN | 未调查 | UNKNOWN |

- 需求修改必须记录变更来源、受影响版本和验收变化；不得把讨论、示例或 AI 建议自动升级为正式需求。
- 单个工程样本只用于验证适用方案，不能覆盖多变体共同约束。

## 2. 系统组成和责任边界

| 子系统/模块 | 输入 | 输出 | 责任 | 运行位置 | 故障影响 | 所有者 | 依据 |
|---|---|---|---|---|---|---|---|
| UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |

浏览器、Local Agent、固件、设备、云/服务器、工装和人工操作必须明确边界；任何层不得绕过另一层的权限或安全门禁。

## 3. 外部接口和版本兼容

| 接口 | 对端/方向 | 物理/协议版本 | 数据/电气合同 | 超时/可用性 | 兼容范围 | 失败降级 | 来源 |
|---|---|---|---|---|---|---|---|
| UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |

| 硬件版本 | Bootloader | 固件 | 配置/schema | 模组/协议 | 工装/生产 | 兼容状态/证据 |
|---|---|---|---|---|---|---|
| UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

未知版本组合不得默认为兼容；必须拒绝、限制功能或进入明确的安全降级。

## 4. 量化系统预算

| 预算对象 | 目标/上限 | 单位 | 分配到模块 | 余量规则 | 测量/计算方法 | 来源/状态 |
|---|---|---|---|---|---|---|
| 启动时间 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |
| 响应/实时性 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |
| 吞吐/丢包 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |
| Flash/RAM/栈 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |
| 功耗/续航 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |
| 热/噪声/精度 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |
| 可靠性/寿命 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未调查 |

没有量化需求时不得宣称“满足性能/功耗/可靠性”；只能报告实测值和需求缺口。

## 5. 风险、故障与安全目标

| 风险/故障 | 原因 | 可观测后果 | 严重度依据 | 检测 | 控制/安全状态 | 验证 | 残余风险批准 |
|---|---|---|---|---|---|---|---|
| UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

AI 不得自行决定风险可接受。涉及人身、燃气、高压、热、运动或法规的残余风险需要有权角色批准。

## 6. 目标市场、标准与认证基线

| 市场/地区 | 产品分类 | 标准/法规及版本 | 适用条款 | 关键配置/器件 | 实验室/报告 | 状态 |
|---|---|---|---|---|---|---|
| UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

- AI 只能整理候选适用性和工程证据，不能自行作最终法律或认证结论。
- 认证样机的硬件、BOM、固件、无线配置、外壳和标签必须能与量产配置比较；差异未评估时禁止声明等同。

## 7. EMC、环境和可靠性项目条件

| 项目 | 等级/条件/时长 | 工作模式 | 判据 | 样本/配置 | 报告位置 | 状态 |
|---|---|---|---|---|---|---|
| ESD/EFT/Surge/RF | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | NOT_RUN |
| 温湿度/热循环 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | NOT_RUN |
| 振动/冲击 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | NOT_RUN |
| 老化/寿命 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | NOT_RUN |
| 防护/材料 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | NOT_RUN |

预扫、内部测试和正式实验室报告必须分开；通过一个工作模式不能覆盖未测试模式。

## 8. BOM、供应链和生命周期

| 位号/功能 | 完整 MPN/厂商 | 批准供应商 | 生命周期状态 | PCN/EOL 来源 | 交期/库存风险 | 替代料验证 | 关键性 |
|---|---|---|---|---|---|---|---|
| UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

- 料号必须完整到后缀、封装、温度/质量等级；模糊料号不能用于采购或替代判断。
- PCN/EOL 必须评估电气、封装、软件、校准、可靠性、认证和制造影响；仅价格或可采购不能证明可替代。
- 可疑批次、来源不明或追溯缺失物料必须隔离，不能用抽测通过自动放行。

## 9. 维护期限、数据迁移和退役

| 对象 | 支持版本/期限 | 兼容/迁移策略 | 备份/恢复 | 停止支持条件 | 退役/数据处理 | 所有者 |
|---|---|---|---|---|---|---|
| 固件/配置 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 工具/Agent/插件 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 测试/生产设备 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 现场设备/备件 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

持久化格式、导入导出和 Agent 接口必须有版本和兼容读取；升级不能直接破坏已有项目、设备、日志和记录。

## 10. 决策、ECO/ECN 和项目批准

| 决策/变更 ID | 变更内容 | 理由/备选 | 影响对象 | 验证要求 | 批准角色 | 生效版本 | 状态 |
|---|---|---|---|---|---|---|---|
| UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

重大器件、接口、板框、协议、存储、升级、安全或认证变更必须有影响分析和可回退基线；Git 提交不能替代工程批准。

## 11. 未决项

| ID | 未知/冲突 | 影响 | 所需确认 | 状态 |
|---|---|---|---|---|
| SYS-PROJ-001 | 系统、需求与生命周期约束尚未初始化 | 无法形成产品级完成判定 | 取得当前需求和产品基线 | OPEN |
