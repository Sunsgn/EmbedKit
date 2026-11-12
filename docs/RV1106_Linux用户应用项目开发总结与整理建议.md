# RV1106 Linux 用户应用项目开发总结与整理建议

- 文档版本：V1.0
- 盘点日期：2026-11-12
- 适用设备：Luckfox Pico Ultra / Ultra W（RV1106，Buildroot Linux）
- 盘点方式：只读检查本地应用、启动脚本、测试、开发约束、固件基线和验证记录
- 整理模式：AUDIT（本文件不修改受保护基线，不部署、不刷新、不重启设备）

## 1. 项目定位

`D:\linux\RV1106\user_app` 不是完整的 Luckfox Linux SDK，也不是单一应用源码仓库，而是一个 RV1106 产品的用户应用与部署覆盖层。它同时保存：

- 板端 Python 控制、通信和图像传输程序；
- BusyBox 启动、摄像头选择和进程守护脚本；
- 预编译的 ARM 用户程序、动态库和 RKNN 模型；
- 主机单元测试和部署验证工具；
- 摄像头驱动/设备树问题的分析与实机验证证据；
- 部分远端 SDK 产物、板端回读文件、原始图像和临时部署目录；
- 一套随根文件系统部署的 Python 3.11 运行依赖。

真正的 Kernel、设备树、驱动和固件构建源码位于 Linux 编译机的标准 SDK：

```text
/home/sunsgne/luckfox-pico
```

因此该项目必须按三类权威位置理解：

```text
远端 SDK：Kernel / DTS / 驱动 / Buildroot / boot.img / KO
     ↓ 构建与制品哈希
本地 user_app：应用、overlay、脚本、测试、模型、部署清单、验证证据
     ↓ 暂存与哈希校验
RV1106 板端：/root、/etc/init.d、/oem/usr/ko、/userdata、运行状态
```

## 2. 项目档案

| 项目项 | 当前事实 |
| --- | --- |
| SoC | Rockchip RV1106，ARM Linux |
| 开发板 | Luckfox Pico Ultra / Ultra W |
| 系统 | Buildroot，Kernel 5.10.160（现有验证记录） |
| 编译机 SDK | `/home/sunsgne/luckfox-pico` |
| 当前 BoardConfig | `BoardConfig-EMMC-Buildroot-RV1106_Luckfox_Pico_Ultra-IPC.mk` |
| 主摄像头 | SC3336，MIPI，已验证基线 |
| 辅助摄像头 | OV3660，DVP，当前图像无效 |
| 主媒体规格 | SC3336，NV12 `2304x1296@30fps` |
| 应用语言 | C++ 媒体核心 + Python 控制/传输 + BusyBox shell 启动 |
| Python | 板端 Python 3.11 依赖覆盖层 |
| AI/媒体 | RKMPI/RKNN、YOLOv5、LPRNet、V4L2、RTSP/RTP-JPEG |
| 云端链路 | WebSocket 控制/图像、HTTP 图片上传 |
| 本地事件 | GPIO2_A7 红外事件，GPIO2 line 7；补光 line 2 |
| 进程间接口 | `/tmp/python_to_cpp_pipe`、`/tmp/cpp_to_python_pipe` |
| 摄像头状态接口 | `/run/camera.env`、`/dev/camera-main` |
| 本地版本管理 | 当前目录不是 Git 仓库 |
| 项目阶段 | SC3336 主链路可用；OV3660 处于硬件改线前诊断收敛阶段 |

## 3. 当前目录与职责

```text
user_app/
├─ root/                    部署到板端 /root 的应用、二进制、库和模型
├─ etc_init.d/              部署到 /etc/init.d 的启动脚本
├─ etc/                     网络等系统配置
├─ src/                     原生程序说明，当前缺少完整 C++ 源码
├─ tests/                   Python 主机单元测试
├─ tools/                   部署和流媒体验证工具
├─ docs/                    工作流、修复方案和验证证据
├─ patches/                 内核/驱动补丁资料
├─ usr_lib_python3.11/      板端 Python 依赖覆盖层
├─ user_bin/                Python/pip 启动文件
├─ .deploy/                 历史部署暂存物
├─ .staging/                诊断和资料暂存物
├─ .bgtask/                 后台任务日志
├─ 已验证固件基线.md        受保护事实与成功/失败边界
├─ 嵌入式应用开发约束.md    用户态开发规范
└─ RV1106固件分层开发约束.md SDK 分层、构建和刷新规范
```

### 3.1 当前规模

| 目录 | 文件数 | 约占空间 |
| --- | ---: | ---: |
| `root/` | 46 | 16.31 MiB |
| `usr_lib_python3.11/` | 2,657 | 45.63 MiB |
| `.deploy/` | 34 | 25.76 MiB |
| `.staging/` | 19 | 10.75 MiB |
| `tests/` | 8（含缓存） | 0.06 MiB |
| `docs/` | 8（新增本文前） | 0.05 MiB |
| `etc_init.d/` | 7 | 0.01 MiB |

项目根目录还保存了约 15 MiB 的 100 帧 RAW 彩条数据及多份 YUV/RAW 诊断文件。它们是有价值的证据，但不适合作为普通源码入口长期平铺。

## 4. 固件与应用分层

### 4.1 Kernel、设备树和驱动层

这一层只在远端标准 SDK 中维护：

- 传感器驱动：`sysdrv/source/kernel/drivers/media/i2c/`；
- RKCIF：`sysdrv/source/kernel/drivers/media/platform/rockchip/cif/`；
- 设备树：`sysdrv/source/kernel/arch/arm/boot/dts/`；
- 内核配置：`sysdrv/source/kernel/arch/arm/configs/`；
- 输出：`sysdrv/source/objs_kernel/`、`output/image/`。

引脚复用、I2C、时钟、regulator、MIPI/DVP endpoint 和摄像头供电复位必须在设备树/驱动层解决，不能由 Python 或 shell 写寄存器代替。

### 4.2 媒体核心层

`root/luckfox_pico_rtsp_yolov5_demo/luckfox_pico_rtsp_yolov5` 是预编译 ARM 媒体核心，承担摄像头、硬件编码、AI 推理或帧生产。它通过 FIFO 与 Python 控制层交互。

当前 `src/luckfox_pico_rtsp_yolov5/` 只有 README，没有对应 C/C++、CMake 和构建源码。正式量产变更不能直接修改二进制，必须找回与当前二进制匹配的源代码、SDK 提交、构建命令和 SHA256。

### 4.3 Python 控制与传输层

项目已形成分层异步应用：

```text
aiot_app.py
    ↓
aiot_device.py
    ├─ CameraFrameBridge      FIFO 帧桥接和消费者管理
    ├─ MotionPhotoService    PIR 触发、补光、抓拍
    ├─ HttpImageUploader     Token、TLS、multipart 上传
    ├─ WebSocketImageService 注册、控制、心跳、图像
    └─ JpegFrameHub          有界的最新 JPEG 帧分发
```

### 4.4 Shell 启动与运行编排层

- `S40camera_select`：读取摄像头状态，定位 media/video 节点，执行有限采帧探针，发布 `/run/camera.env` 和 `/dev/camera-main`；
- `S99app_start`：启动可选 Python 入口，并在摄像头已就绪时启动守护程序；
- `restart_luckfox_yolov5.sh`：守护媒体核心和 AIoT Python 进程，在图片上传与 RTSP 测试模式之间切换；
- `S99ov3660_rtsp`：仅当 OV3660 被选中且就绪时启动直连 RTSP 应用；
- `rtsp_test.sh`：临时切换 RTSP 测试模式，重启后不保留。

## 5. 应用运行架构

### 5.1 摄像头选择

```text
驱动绑定与 media 拓扑
       ↓
摄像头状态生成方
       ↓ /run/camera.env
S40camera_select
       ├─ 查找 sensor 所在 media
       ├─ 查找 rkisp_mainpath / stream_cif_dvp_id0
       ├─ 有界采帧探针
       ├─ CAMERA_READY=0/1
       └─ /dev/camera-main → 实际 /dev/videoN
```

应用应消费稳定状态接口，不能假设 `/dev/video11` 或 `/dev/video31` 永远不变。

### 5.2 C++ 与 Python 帧桥接

```text
Python → /tmp/python_to_cpp_pipe
         start_stream / ack / stop_stream

C++ → /tmp/cpp_to_python_pipe
       十进制长度 + 换行 + JPEG 字节 + 换行
```

`CameraFrameBridge` 已处理：

- 短读和 EOF；
- 帧头最大长度；
- 最大帧 10 MiB；
- 完整帧超时；
- 消费者从 0 到 1 时启动、从 1 到 0 时停止；
- FIFO 断开后的重新打开；
- 取消任务时停止帧流并释放文件描述符。

### 5.3 PIR 抓拍上传

```text
GPIO2_A7 边沿
  → 去抖与低电平重新布防
  → 开补光
  → 注册一次性帧消费者
  → 等待 JPEG
  → HTTP 上传
  → 关补光并进入冷却期
```

GPIO 使用 character device/periphery 接口，没有新增 sysfs GPIO 路径。

### 5.4 WebSocket 与 HTTP

- WebSocket 用于设备注册、心跳、远程图像消费和连接管理；
- HTTP 用于 PIR 图片上传，支持静态 Token 或通过环境变量提供客户端凭据；
- HTTP multipart 字段名、URL、证书指纹和 Token 响应路径均有输入校验；
- Token 失效后有一次受控刷新；
- 凭据应只存在板端受控环境文件，不进入源码、测试或日志。

### 5.5 RTSP

存在两条路径：

1. C++ 媒体核心负责原生推流；
2. Python `rtsp_jpeg_server.py` 根据 RFC 2435 将 JPEG 封装为 RTP，支持 RTSP over TCP 和 UDP。

OV3660 诊断路径使用 `direct_v4l2_rtsp.py` 从 V4L2 获取 YUYV，经 FFmpeg 转 MJPEG，再进入 Python RTP/JPEG 服务。网络与解码已验证，但上游像素仅两位有效，因此不能视为有效图像链路成功。

## 6. 测试体系现状

当前有 4 个 Python 测试文件、14 个静态可识别测试方法：

| 测试文件 | 用例数 | 覆盖内容 |
| --- | ---: | --- |
| `test_http_image_transport.py` | 6 | Token、multipart、默认配置、TLS 指纹、空图片 |
| `test_motion_photo.py` | 2 | PIR 抓拍、补光、GPIO 事件、资源释放 |
| `test_rtsp_jpeg_server.py` | 4 | JPEG 解析、RTP 分包、RTSP TCP/UDP |
| `test_websocket_transport.py` | 2 | 注册、心跳、图像命令和流控制 |

已有测试属于主机逻辑证据，不能替代 RV1106 上的 ABI、V4L2、GPIO、CPU/RSS 和长稳验证。

## 7. 已验证固件基线

### 7.1 SC3336：成功且受保护

- 传感器地址 `0x30`，芯片 ID `0xcc41`；
- 链路：`SC3336 -> MIPI D-PHY -> RKCIF -> RKISP`；
- 当前验证节点 `/dev/video11`；
- NV12 `2304x1296@30fps`；
- Kernel/Boot 已成功启动，写入回读哈希曾与构建产物一致。

该链路不能因 OV3660、GPIO 或用户应用需求被无关修改、回退或重复刷写。

### 7.2 OV3660 模块：只证明可加载

`ov3660.ko` 能加载，但“模块可加载”不代表传感器能输出有效图像。

### 7.3 OV3660 帧同步和 DMA：成功返回数据但图像无效

已经证明：

- I2C、传感器测试图、帧同步、IRQ 和 DMA 基本通路存在；
- `/dev/video31` 可以返回规定长度的 YUYV/RAW8 帧；
- RTSP/RTP/JPEG 网络路径可以被 ffprobe/ffmpeg 识别并解码；
- 但实际采集数据只有 bit0/bit1 活动，画面无效。

### 7.4 OV3660 根因已收敛到物理位映射

RV1106 的 M0 是 16-bit VICAP 总线，8-bit 模式使用 M0 D8:D15；M1 的 8-bit 模式使用 M1 D2:D9。当前硬件将 OV3660 八位接到 M0 D2:D9，与 M0 采集位域只重叠 D8/D9，精确解释 DMA 中只有两位有效。

结论：

- 不能通过 `data-shift`、`CIF_HIGH_ALIGN`、PATH 常量或像素格式变换修复；
- 禁止重复 RAW8、格式矩阵、极性、PCLK、逐线连通和寄存器猜测；
- 后续只能改线到 M0 D8:D15，或整组切换到 M1 D2:D9，再做最小 DTS 适配；
- 硬件修改前，OV3660 不能进入有效图像、RKISP、量产 RTSP 或帧率验收。

## 8. 当前工程风险和技术债

风险级别用于确定治理顺序，不代表所有项目都已经造成运行故障。

### 8.1 阻断：OV3660 需要硬件改线

当前故障已经越过应用层、格式解析和软件对齐边界。继续通过 Python、FFmpeg、DTS `data-shift` 或驱动常量尝试恢复六个缺失位，只会重复已排除路径。

### 8.2 高：本地目录不是 Git 仓库

应用、脚本、测试和部署资料无法通过本地 commit 追溯。现有基线也明确记录应用层无 Git commit。后续应建立独立应用仓库，或把本目录作为正式 SDK overlay 纳入已有仓库；初始化前先排除凭据、RAW、固件、缓存和临时部署文件。

### 8.3 高：原生媒体程序缺少对应源码

项目保存两个约 3.2 MiB 的二进制版本，但 `src/` 只有 README。缺少源码会导致：

- 无法审计 FIFO 协议和资源生命周期；
- 无法从当前 SDK 可复现构建；
- 无法安全修改摄像头、编码、推理和推流；
- 无法证明两个二进制的版本差异。

### 8.4 高：依赖覆盖层混入不同架构

`usr_lib_python3.11/` 约 45.63 MiB，文件中既有 ARM 扩展，也可见 `x86_64-linux-gnu.so`。如果整体复制到板端，可能造成空间浪费、错误模块优先加载或 ABI 冲突。

应在 RV1106 Buildroot/sysroot 中生成精确依赖清单，只部署 ARM 目标实际 import 的模块，不复制开发机完整 site-packages。

### 8.5 高：敏感配置边界

`etc/wpa_supplicant.conf` 和板端 `aiot_http.env` 可能承载 Wi-Fi 或服务凭据。它们不应进入公共 Git、总结正文、构建日志或发布包清单明文。应提供无凭据模板，实际值由受控生产/部署流程注入。

### 8.6 中：应用入口存在历史单体与分层版本

`aiot_device.py` 是当前分层入口，但仍保留较大的 `aiot_device_rtsp.py` 历史单体实现。两条路径均可被启动脚本选择，公共常量和桥接逻辑存在重复风险。

在完成板端回归前不要直接删除旧入口；应先建立“量产图片上传模式”和“临时 RTSP 测试模式”的版本矩阵，再决定归档或收口。

### 8.7 中：启动脚本的进程管理边界

`S99app_start stop` 使用 `killall python`，可能停止非本项目 Python 进程；其他脚本已有更精确的 `/proc/*/cmdline` 匹配和 PID 文件。后续应统一为明确进程所有权，但修改启动链路前必须保护现有可用基线并执行板端 Canary。

### 8.8 中：临时制品和证据混放

根目录、`.deploy/`、`.staging/` 和 `.codex-*` 中存在 boot.img、KO、RAW、YUV、图片和诊断副本。它们有的属于关键证据，有的只是中间文件，目前缺少统一 manifest 区分。

任何清理都必须先按验证记录核对引用、文件长度和 SHA256，禁止直接批量删除。

### 8.9 中：摄像头自动选择尚未完整验收

`S40camera_select` 已具备跨 media 搜索、稳定链接、状态文件和后台探针，但尚缺：

- 完整开机自动识别记录；
- 两种摄像头硬件切换验证；
- OV3660 有效图像验证；
- 选择、探针、应用启动之间的长稳和竞争测试。

### 8.10 中：发布清单不完整

Kernel/Boot 和部分 KO 已有哈希证据，但历史基线仍缺 SDK 完整版本、BoardConfig、受保护文件全集和统一应用 manifest。应用二进制、Python 文件、模型、动态库和依赖应作为同一版本发布。

## 9. 建议的目标目录

不应立即移动现有文件。目标结构用于逐步治理：

```text
user_app/
├─ README.md
├─ PROJECT_PROFILE.md
├─ AGENTS.md
├─ app/
│  ├─ python/               当前 root/*.py
│  ├─ native/               找回的 C++ 源码与构建文件
│  └─ shell/                应用运行脚本
├─ overlay/
│  ├─ root/                 最终部署到 /root 的文件
│  ├─ etc/init.d/           正式启动脚本
│  └─ usr/lib/python3.11/   经过裁剪的 ARM 依赖
├─ models/                  RKNN、标签、版本和哈希清单
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ board/                板端短探针
├─ tools/
├─ docs/
│  ├─ architecture/
│  ├─ deployment/
│  ├─ verification/
│  └─ troubleshooting/
├─ artifacts/               不进源码 Git，外部受控制品库
└─ manifests/               发布版本、路径、大小和 SHA256
```

移动现有文件会影响 overlay、启动脚本和部署路径，必须在建立 manifest 和回归测试后分阶段执行。

## 10. 分阶段整理计划

### 阶段 0：冻结当前事实

- 记录本地全部文件清单、大小、mtime 和 SHA256；
- 标记受保护基线、失败诊断和普通临时文件；
- 记录板端当前应用、脚本、模型、动态库和依赖哈希；
- 记录远端 SDK Git 状态、提交和 BoardConfig；
- 不刷新、不重启、不覆盖现有运行文件。

验收：可以回答每个板端文件来自哪里、属于哪个版本、是否有源码。

### 阶段 1：建立应用版本管理

- 在排除凭据和大文件后建立应用 Git 仓库；
- 新增精确 `.gitignore`；
- 建立 `PROJECT_PROFILE.md` 和项目 README；
- 将原始 RAW、boot.img、KO、模型和大二进制转移到受控制品库或 Git LFS；
- 仓库只保存 manifest、哈希和受控获取位置。

这一步涉及大批文件归属和可能的移动/移除，必须另行确认精确范围。

### 阶段 2：恢复原生源码和可复现构建

- 找回 `luckfox_pico_rtsp_yolov5` 对应源代码；
- 固定 Luckfox SDK 提交、工具链、sysroot 和构建命令；
- 记录二进制、动态库、模型和标签的 SHA256；
- 验证 FIFO 协议与 Python 当前实现一致；
- 禁止把二进制补丁作为量产构建方法。

### 阶段 3：依赖裁剪

- 从实际 import 和板端运行日志生成依赖白名单；
- 检查所有 `.so` 的 ELF 架构和动态依赖；
- 删除发布包中的 x86_64 扩展、pip 测试和无关包；
- 通过 Buildroot package 或确定性的离线 wheel/overlay 生成依赖；
- 记录 Python 版本、包版本和哈希。

### 阶段 4：启动与应用收口

- 明确默认量产入口和临时 RTSP 测试入口；
- 统一 PID、单实例、停止和健康检查；
- 用准确 PID/命令行匹配替换宽泛 `killall python`；
- 把公共配置继续收口到 `aiot_config.py`；
- 验证正常退出、异常退出、FIFO 断开和重连后无重复进程。

### 阶段 5：硬件修订后的 OV3660 验证

1. 选择 M0 D8:D15 或 M1 D2:D9 并完成硬件改线；
2. 只做对应的最小 DTS/pinctrl 适配；
3. 验证 I2C、XCLK、RESET、media 链路和 RAW/YUYV 有效像素；
4. 验证连续采帧、格式、实际帧率和无 overflow；
5. 再进入 FFmpeg、RTSP、开机选择和长稳测试；
6. 成功后更新 `已验证固件基线.md`。

### 阶段 6：统一发布

统一 manifest 至少包含：

- 应用版本和本地 Git commit；
- SDK commit、BoardConfig、DTS 和 defconfig；
- boot.img、DTB、KO；
- C++ 程序、Python、shell、模型、动态库和依赖；
- 每个文件的目标路径、大小和 SHA256；
- 跨语言 FIFO 协议版本；
- 测试证据、已知问题、回退/恢复方法和批准记录。

## 11. 建议测试矩阵

| 区域 | 主机测试 | 板端集成 | 系统/长稳 |
| --- | --- | --- | --- |
| 配置 | 环境变量、非法 URL、边界值 | 板端 Python 实际加载 | 重启后配置一致性 |
| FIFO | 短读、EOF、超长、超时 | C++/Python 双端真实 FIFO | 断开重连、消费者抖动 |
| HTTP | Token、401、multipart、证书指纹 | 实际 TLS 和上传 | 断网、弱网、Token 过期 |
| WebSocket | 注册、心跳、控制和退避 | 实际服务器连接 | 24/72 小时重连与资源 |
| GPIO | fake GPIO、去抖、重新布防 | GPIO2_A7 实际边沿 | 高频触发、异常恢复 |
| RTSP | JPEG、RTP、TCP/UDP 协议 | VLC/ffprobe/ffmpeg 拉流 | 多客户端、断连、长稳 |
| 摄像头选择 | shell 环境模拟 | SC3336/OV3660 硬件切换 | 冷启动、重复启动、失败降级 |
| 媒体核心 | C++ 缓冲和资源测试 | NV12、编码、RKNN、FIFO | fps、CPU、RSS、FD、温度 |
| 固件 | DTB/KO 静态核对 | 模块、拓扑、采帧 | 重启、断电恢复和基线回归 |

测试结论必须分级：主机逻辑通过、交叉构建通过、板端程序通过、真实媒体链路通过、长稳通过，不能互相替代。

## 12. Linux 嵌入式项目的通用经验

从该项目可提炼出以下 Linux 产品开发方法：

1. 先分清 Kernel、设备树、驱动、系统集成、媒体和应用层，问题在哪一层就在哪一层修；
2. 用户应用只消费稳定设备接口，不能通过写寄存器掩盖驱动和 DTS 错误；
3. `/dev/videoN` 是枚举结果，产品应用应使用状态文件、media entity 或稳定链接；
4. 预编译二进制必须有源代码、工具链、版本和哈希，不能成为不可维护黑盒；
5. Python 适合编排和低频控制，C++ 负责高吞吐媒体路径，shell 只做启动探针；
6. 跨进程协议需要长度、上限、超时、短读、EOF 和版本；
7. 构建、传输、安装、分区回读和功能验证是五种不同证据；
8. 摄像头“有节点”“能 STREAMON”“有 DMA 数据”“图像有效”“达到帧率”“可长稳”是不同里程碑；
9. 失败实验同样要记录，明确禁止重复已经排除的路径；
10. 受保护基线让新增故障不会反复破坏已经跑通的主链路。

## 13. AI 后续开发规则建议

1. 每次先读 `已验证固件基线.md`，保护 SC3336 和已确认的 Kernel/Boot；
2. 应用修改前读 `嵌入式应用开发约束.md`，SDK 修改前读分层约束；
3. 只读取目标模块、调用者、启动入口和验证脚本；
4. 不把 OV3660 缺位问题转移到 Python、FFmpeg 或像素格式层；
5. 不重复已排除的 RAW8、极性、PCLK、`data-shift` 和 `CIF_HIGH_ALIGN` 实验；
6. 不在应用中固定 `/dev/video11`，使用 `/run/camera.env` 或 `/dev/camera-main`；
7. 不把 Windows/x86 Python 环境整体复制到 ARM 板端；
8. 不修改没有对应源码的量产二进制；
9. 部署先到 `/userdata` 暂存并校验，覆盖、权限变更和重启前单独确认；
10. 最终报告必须给出源、暂存、安装和回读哈希，以及真实板端结果。

## 14. 随系统增长需要复查的点

- C++ 媒体核心源码和构建来源是否已经补齐；
- Python 依赖是否全部为 ARM 目标且经过裁剪；
- 模型、动态库和应用 ABI 是否与 SDK/rootfs 一致；
- FIFO 是否需要增加显式协议版本和帧类型；
- 多个视频消费者是否始终只有一个采集所有者；
- Python RTSP 的 CPU、RSS 和帧率是否满足量产要求；
- HTTP 证书校验/指纹轮换和凭据注入是否受控；
- WebSocket、HTTP、RTSP 同时运行时的带宽、CPU、内存和温度；
- 启动脚本是否可能生成重复进程或误杀其他 Python 服务；
- 日志、RAW、JPEG 和临时文件是否有容量上限与轮转；
- OV3660 硬件改版后是否完成 SC3336 回归；
- boot、KO、应用、模型和配置是否作为同一产品版本发布。

## 15. 本次整理结论

该项目已经形成较成熟的 Linux 嵌入式分层意识：底层固件在标准 SDK 中维护，应用层使用 C++、Python 和 BusyBox shell 各自承担合适职责，并通过固件基线和验证证据保护已经跑通的链路。尤其是 OV3660 问题从 I2C、帧同步、DMA、像素格式一路收敛到物理位映射，说明以证据逐层排除比反复试写寄存器更有效。

当前优先级应为：保护 SC3336 成功基线，停止 OV3660 的重复软件试验，建立本地应用版本管理，找回原生媒体源码，裁剪 ARM Python 依赖，并为应用与固件建立统一 manifest。硬件改线完成后，再按“DTS/驱动 → 节点/拓扑 → 有效图像 → 编码/推流 → 长稳”的顺序恢复 OV3660 开发。
