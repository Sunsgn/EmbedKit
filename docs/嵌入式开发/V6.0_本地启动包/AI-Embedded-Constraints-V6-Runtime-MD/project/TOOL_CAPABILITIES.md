# AI与本地工具能力

| 能力 | 可用状态 | 工具/版本 | 权限 | 失败时降级 |
|---|---|---|---|---|
| 读取和编辑源码 | UNKNOWN | UNKNOWN | UNKNOWN | 只读分析 |
| 构建/链接/静态分析 | UNKNOWN | UNKNOWN | UNKNOWN | 输出待执行命令，标记NOT_RUN |
| EDA源文件读取 | UNKNOWN | UNKNOWN | UNKNOWN | PDF/网表静态审核并声明盲区 |
| EDA编辑与ERC/DRC | UNKNOWN | UNKNOWN | UNKNOWN | PLAN_ONLY |
| Gerber独立回读 | UNKNOWN | UNKNOWN | UNKNOWN | 制造输出不得PASS |
| 串口/网络/调试器 | UNKNOWN | UNKNOWN | UNKNOWN | 保存配置，标记UNAVAILABLE |
| 示波器/逻辑分析仪/电源 | UNKNOWN | UNKNOWN | UNKNOWN | 给出测量步骤，标记NOT_RUN |
| 固件烧录 | UNKNOWN | UNKNOWN | 单独授权 | 不执行，仅准备 |
| Git提交/推送 | UNKNOWN | UNKNOWN | 推送需授权 | 提供差异与建议 |

工具可用不等于动作已授权；工具不可用也不允许伪造结果。
