# 当前项目验证、生产与质量具体约束

> 本文件把“需要测试”落实为当前项目的测试对象、连接、命令、上下限、设备身份、失败判据、报告位置和生产门禁。

## 1. 验收需求到测试追踪

| 需求/风险 ID | 可测量验收条件 | 测试层级 | 输入/前置条件 | 上下限/容差 | 失败处理 | 证据 | 状态 |
|---|---|---|---|---|---|---|---|
| UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | NOT_RUN |

- “功能正常”“通信正常”“性能良好”不是可执行验收条件；必须写出输入、输出、单位、窗口、次数和边界。
- 每个安全、接口、协议、存储迁移和恢复需求至少有正常与失败路径。

## 2. 测试层级和精确入口

| 层级 | 工作目录 | 命令/工具/脚本 | 测试目标 | 环境/夹具 | 报告位置 | PASS 判据 | 状态 |
|---|---|---|---|---|---|---|---|
| 单元测试 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | NOT_RUN |
| 静态检查 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | NOT_RUN |
| 主机/仿真测试 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | NOT_RUN |
| 软件集成 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | NOT_RUN |
| HIL/设备测试 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | NOT_RUN |
| 长稳/可靠性 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | NOT_RUN |

主机、Mock、仿真、HIL 和真实设备必须分层报告；低层通过不得提升成高层 PASS。

## 3. 设备、仪器、端口和身份

| ID | 类型/型号 | 序列号/校准有效期 | 连接/端口 | 板卡/BOM 版本 | 固件/配置哈希 | 用途 | 状态 |
|---|---|---|---|---|---|---|---|
| UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

- 测试前必须确认当前目标对象，禁止仅凭可变端口名或显示名选择设备。
- 测量仪器量程、精度、带宽和校准必须覆盖被测量；不满足时结果只能作为参考。

## 4. 设备测试步骤

| 步骤 ID | 前置状态 | 操作/激励 | 采集信号 | 期望与时间窗 | 超时/停止条件 | 恢复动作 | 原始证据 |
|---|---|---|---|---|---|---|---|
| UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

- 每一步都要能定位首次失败；不得只保留最终“失败”或被重试覆盖后的结果。
- 设备断开、进程取消、队列满、日志写满、夹具异常和应用重启必须有恢复与资源释放步骤。

## 5. 通信和协议验证矩阵

| 链路/用例 | 正常 | 半包/粘包 | 坏长度/校验 | 超时/迟到 | 重复/乱序 | 队列满 | 断开恢复 | 报告 |
|---|---|---|---|---|---|---|---|---|
| UNKNOWN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | UNKNOWN |

测试必须保存原始字节流、时间和连接配置；解析后的文字不能替代原始数据。

## 6. 边界、故障注入和恢复

| 对象 | 最小/最大 | 非法/损坏 | 资源耗尽 | 断电/复位 | 取消/恢复 | 重复执行 | 当前结果 |
|---|---|---|---|---|---|---|---|
| UNKNOWN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN |

故障注入不得越过设备安全边界；会造成损坏、危险动作或不可恢复写入的测试必须有专用夹具和明确授权。

## 7. 生产流程和工位合同

| 工位 | 输入物料/版本 | 工具/脚本版本 | 操作 | 限值/超时 | 输出记录 | 失败隔离/返修 | 权限 |
|---|---|---|---|---|---|---|---|
| 来料/装配检查 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 烧录 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 需生产授权 |
| 校准 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 需生产授权 |
| 功能测试 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 标签/序列号 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 需生产授权 |
| 包装/OQC | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

- 烧录、密钥、身份和校准结果必须绑定唯一设备和物料版本；失败重试不得产生重复身份或覆盖合格数据。
- 工位离线、脚本中断或状态未知时，非幂等写入不得自动重放，产品进入隔离状态。

## 8. 校准和量值追溯

| 被校量 | 标准器/溯源 | 校准点 | 环境条件 | 算法/系数版本 | 接受限 | 独立验证点 | 存储/防误写 |
|---|---|---|---|---|---|---|---|
| UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

必须保存原始点、拟合残差、系数、算法版本和验证点；只保存最终系数无法证明校准有效。

## 9. 质量追溯和数据保留

| 对象 | 稳定 ID | 必需字段 | 格式版本 | 保存期限/容量 | 导出/恢复 | 访问控制 | 状态 |
|---|---|---|---|---|---|---|---|
| 设备/批次 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 固件/配置 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 物料/BOM | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 测试/校准 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |
| 返修/RMA | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

日志和结果必须有大小、条数或轮转上限；导出后仍应能关联当前源码、固件、设备、配置和工具版本。

## 10. 放行门禁

| 门禁 | 当前要求 | 证据 | 状态 | 未通过动作 |
|---|---|---|---|---|
| 需求覆盖 | UNKNOWN | UNKNOWN | NOT_RUN | 禁止放行 |
| 软件回归 | UNKNOWN | UNKNOWN | NOT_RUN | 禁止放行 |
| 设备验证 | UNKNOWN | UNKNOWN | NOT_RUN | 标记受限/阻塞 |
| ERC/DRC/制造输出 | UNKNOWN | UNKNOWN | NOT_RUN | 禁止制板 |
| 产测能力 | UNKNOWN | UNKNOWN | NOT_RUN | 禁止量产 |
| 追溯完整性 | UNKNOWN | UNKNOWN | NOT_RUN | 隔离产品 |

## 11. 未决项

| ID | 未知/冲突 | 影响 | 所需证据 | 状态 |
|---|---|---|---|---|
| TEST-PROJ-001 | 项目验证与制造约束尚未初始化 | 无法形成项目级 PASS | 建立验收与测试入口 | OPEN |
