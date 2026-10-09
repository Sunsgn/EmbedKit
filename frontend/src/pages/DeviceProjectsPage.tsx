import { useEffect, useMemo, useState } from "react";
import {
  Cpu,
  Download,
  FileUp,
  Plus,
  Radio,
  Save,
  Trash2,
  Usb,
} from "lucide-react";
import { listSerialPorts, type SerialAgentPort } from "../services/serialAgent";
import {
  deleteDeviceProject,
  listDeviceProjects,
  saveDeviceProject,
  setProductSetting,
} from "../services/productStorage";
import {
  createDefaultSerialChannel,
  createDeviceProject,
  type DeviceChannel,
  type DeviceProfile,
  type DeviceProject,
} from "../types/product";

const createNetworkChannel = (
  kind: "tcp" | "udp" | "websocket",
): DeviceChannel => ({
  id: crypto.randomUUID(),
  name: kind === "websocket" ? "WebSocket" : kind.toUpperCase(),
  kind,
  enabled: true,
  autoConnect: false,
  reconnectEnabled: true,
  reconnectIntervalMs: 1000,
  reconnectMaxAttempts: 5,
  websocketUrl: kind === "websocket" ? "ws://127.0.0.1:8080" : undefined,
  network:
    kind === "websocket"
      ? undefined
      : { role: "client", host: "127.0.0.1", port: 9000, localPort: 0 },
});

export default function DeviceProjectsPage() {
  const [projects, setProjects] = useState<DeviceProject[]>([]),
    [selectedId, setSelectedId] = useState(""),
    [deviceId, setDeviceId] = useState(""),
    [ports, setPorts] = useState<SerialAgentPort[]>([]),
    [message, setMessage] = useState("");
  const project =
    projects.find((item) => item.id === selectedId) ?? projects[0] ?? null;
  const device =
    project?.devices.find((item) => item.id === deviceId) ??
    project?.devices[0] ??
    null;

  useEffect(() => {
    void (async () => {
      const loaded = await listDeviceProjects();
      if (loaded.length) {
        setProjects(loaded);
        setSelectedId(loaded[0].id);
        setDeviceId(loaded[0].devices[0]?.id ?? "");
      } else {
        const created = createDeviceProject("我的设备项目");
        await saveDeviceProject(created);
        setProjects([created]);
        setSelectedId(created.id);
        setDeviceId(created.devices[0].id);
      }
    })();
    void listSerialPorts()
      .then(setPorts)
      .catch(() => setPorts([]));
  }, []);

  const commit = (next: DeviceProject) => {
    setProjects((all) =>
      all.map((item) => (item.id === next.id ? next : item)),
    );
    void saveDeviceProject(next);
    setMessage("已保存");
    window.setTimeout(() => setMessage(""), 1200);
  };
  const updateProject = (patch: Partial<DeviceProject>) => {
    if (project)
      commit({ ...project, ...patch, updatedAt: new Date().toISOString() });
  };
  const updateDevice = (patch: Partial<DeviceProfile>) => {
    if (!project || !device) return;
    commit({
      ...project,
      devices: project.devices.map((item) =>
        item.id === device.id ? { ...item, ...patch } : item,
      ),
    });
  };
  const updateChannel = (id: string, patch: Partial<DeviceChannel>) => {
    if (!device) return;
    updateDevice({
      channels: device.channels.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  };
  const addProject = () => {
    const created = createDeviceProject(`设备项目 ${projects.length + 1}`);
    setProjects((all) => [created, ...all]);
    setSelectedId(created.id);
    setDeviceId(created.devices[0].id);
    void saveDeviceProject(created);
  };
  const removeProject = async () => {
    if (
      !project ||
      projects.length <= 1 ||
      !window.confirm(`删除设备项目“${project.name}”？`)
    )
      return;
    await deleteDeviceProject(project.id);
    const rest = projects.filter((item) => item.id !== project.id);
    setProjects(rest);
    setSelectedId(rest[0].id);
    setDeviceId(rest[0].devices[0]?.id ?? "");
  };
  const addDevice = () => {
    if (!project) return;
    const created: DeviceProfile = {
      id: crypto.randomUUID(),
      name: `测试设备 ${project.devices.length + 1}`,
      serialNumber: "",
      hardwareVersion: "",
      firmwareVersion: "",
      channels: [createDefaultSerialChannel()],
    };
    commit({ ...project, devices: [...project.devices, created] });
    setDeviceId(created.id);
  };
  const removeDevice = () => {
    if (!project || !device || project.devices.length <= 1) return;
    const devices = project.devices.filter((item) => item.id !== device.id);
    commit({ ...project, devices });
    setDeviceId(devices[0].id);
  };
  const addChannel = (kind: DeviceChannel["kind"]) => {
    if (!device) return;
    const channel =
      kind === "serial"
        ? createDefaultSerialChannel(
            `串口 ${device.channels.filter((item) => item.kind === "serial").length + 1}`,
          )
        : createNetworkChannel(kind);
    updateDevice({ channels: [...device.channels, channel] });
  };
  const removeChannel = (id: string) => {
    if (device)
      updateDevice({
        channels: device.channels.filter((item) => item.id !== id),
      });
  };
  const activateProject = () => {
    if (!project || !device) return;
    void Promise.all([
      setProductSetting("activeProjectId", project.id),
      setProductSetting("activeDeviceId", device.id),
    ]);
    setMessage("已设为当前设备");
  };
  const downloadProject = () => {
    if (!project) return;
    const payload = {
      schema: "embedkit.device-project",
      version: 1,
      exportedAt: new Date().toISOString(),
      project,
    };
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      }),
    );
    link.download = `embedkit-project-${project.name || project.id}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const importProject = async (file: File) => {
    try {
      const payload = JSON.parse(await file.text()) as {
        schema?: string;
        version?: number;
        project?: DeviceProject;
      };
      if (
        payload.schema !== "embedkit.device-project" ||
        payload.version !== 1 ||
        !payload.project?.name ||
        !Array.isArray(payload.project.devices)
      )
        throw new Error("不是受支持的设备项目文件");
      const now = new Date().toISOString(),
        imported: DeviceProject = {
          ...payload.project,
          id: crypto.randomUUID(),
          name: `${payload.project.name}（导入）`,
          createdAt: now,
          updatedAt: now,
          devices: payload.project.devices.map((item) => ({
            ...item,
            id: crypto.randomUUID(),
            channels: (item.channels ?? []).map((channel) => ({
              ...channel,
              id: crypto.randomUUID(),
            })),
          })),
        };
      await saveDeviceProject(imported);
      setProjects((all) => [imported, ...all]);
      setSelectedId(imported.id);
      setDeviceId(imported.devices[0]?.id ?? "");
      setMessage("项目导入成功");
    } catch (reason) {
      setMessage(
        `导入失败：${reason instanceof Error ? reason.message : String(reason)}`,
      );
    }
  };
  const summary = useMemo(
    () =>
      project
        ? `${project.devices.length} 台设备 · ${project.devices.reduce((count, item) => count + item.channels.length, 0)} 个通道`
        : "",
    [project],
  );

  return (
    <div className="h-full overflow-hidden p-4">
      <div className="mx-auto grid h-full max-w-[1600px] grid-cols-[230px_minmax(0,1fr)] gap-3">
        <aside className="flex min-h-0 flex-col rounded-xl border border-[#30363d] bg-[#0d1117]">
          <div className="flex items-center justify-between border-b border-[#30363d] p-3">
            <div>
              <h1 className="text-sm font-semibold">设备项目</h1>
              <p className="text-[10px] text-gray-600">
                项目、设备与通道统一管理
              </p>
            </div>
            <button
              onClick={addProject}
              className="rounded bg-blue-600 p-1.5"
              title="新建设备项目"
            >
              <Plus size={13} />
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2 scrollbar-thin">
            {projects.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedId(item.id);
                  setDeviceId(item.devices[0]?.id ?? "");
                }}
                className={`w-full rounded-lg border p-2.5 text-left ${item.id === project?.id ? "border-blue-500/50 bg-blue-500/10" : "border-transparent hover:bg-[#161b22]"}`}
              >
                <b className="block truncate text-xs">{item.name}</b>
                <small className="text-[9px] text-gray-600">
                  {item.productModel || "未设置型号"} · {item.devices.length} 台
                </small>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1 border-t border-[#30363d] p-2">
            <label className="flex cursor-pointer items-center justify-center gap-1 rounded border border-[#30363d] py-1.5 text-[10px] text-gray-400">
              <FileUp size={11} />
              导入
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importProject(file);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <button
              onClick={downloadProject}
              disabled={!project}
              className="flex items-center justify-center gap-1 rounded border border-[#30363d] py-1.5 text-[10px] text-gray-400 disabled:opacity-30"
            >
              <Download size={11} />
              导出
            </button>
            <button
              onClick={removeProject}
              disabled={projects.length <= 1}
              className="col-span-2 flex items-center justify-center gap-1 rounded border border-red-500/20 py-1.5 text-[10px] text-red-400 disabled:opacity-30"
            >
              <Trash2 size={11} />
              删除项目
            </button>
          </div>
        </aside>
        {project && device && (
          <main className="min-h-0 overflow-y-auto rounded-xl border border-[#30363d] bg-[#0d1117] p-4 scrollbar-thin">
            <header className="mb-4 flex items-center gap-3 border-b border-[#30363d] pb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                <Cpu size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <input
                  value={project.name}
                  onChange={(event) =>
                    updateProject({ name: event.target.value })
                  }
                  className="w-full bg-transparent text-lg font-semibold outline-none"
                />
                <p className="text-[10px] text-gray-600">{summary}</p>
              </div>
              <span className="text-[10px] text-green-400">{message}</span>
              <button
                onClick={activateProject}
                className="flex items-center gap-1 rounded bg-blue-600 px-3 py-2 text-xs"
              >
                <Save size={12} />
                设为当前设备
              </button>
            </header>
            <section className="mb-4 grid gap-3 rounded-xl border border-[#30363d] bg-[#111820] p-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-[10px] text-gray-500">
                产品型号
                <input
                  value={project.productModel}
                  onChange={(event) =>
                    updateProject({ productModel: event.target.value })
                  }
                  className="field"
                />
              </label>
              <label className="text-[10px] text-gray-500">
                芯片/模组
                <input
                  value={project.chipModel}
                  onChange={(event) =>
                    updateProject({ chipModel: event.target.value })
                  }
                  className="field"
                />
              </label>
              <label className="text-[10px] text-gray-500">
                标签
                <input
                  value={project.tags.join(", ")}
                  onChange={(event) =>
                    updateProject({
                      tags: event.target.value
                        .split(",")
                        .map((value) => value.trim())
                        .filter(Boolean),
                    })
                  }
                  className="field"
                />
              </label>
              <label className="text-[10px] text-gray-500">
                说明
                <input
                  value={project.description}
                  onChange={(event) =>
                    updateProject({ description: event.target.value })
                  }
                  className="field"
                />
              </label>
            </section>
            <section className="mb-4 rounded-xl border border-[#30363d] bg-[#111820]">
              <div className="flex items-center justify-between border-b border-[#30363d] p-3">
                <div className="flex gap-1.5 overflow-x-auto">
                  {project.devices.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setDeviceId(item.id)}
                      className={`rounded px-3 py-1.5 text-xs ${item.id === device.id ? "bg-blue-600 text-white" : "bg-[#161b22] text-gray-400"}`}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={addDevice}
                    className="flex items-center gap-1 text-xs text-blue-400"
                  >
                    <Plus size={11} />
                    设备
                  </button>
                  <button
                    onClick={removeDevice}
                    disabled={project.devices.length <= 1}
                    className="text-red-400 disabled:opacity-30"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="text-[10px] text-gray-500">
                  设备名称
                  <input
                    value={device.name}
                    onChange={(event) =>
                      updateDevice({ name: event.target.value })
                    }
                    className="field"
                  />
                </label>
                <label className="text-[10px] text-gray-500">
                  序列号
                  <input
                    value={device.serialNumber}
                    onChange={(event) =>
                      updateDevice({ serialNumber: event.target.value })
                    }
                    className="field"
                  />
                </label>
                <label className="text-[10px] text-gray-500">
                  硬件版本
                  <input
                    value={device.hardwareVersion}
                    onChange={(event) =>
                      updateDevice({ hardwareVersion: event.target.value })
                    }
                    className="field"
                  />
                </label>
                <label className="text-[10px] text-gray-500">
                  固件版本
                  <input
                    value={device.firmwareVersion}
                    onChange={(event) =>
                      updateDevice({ firmwareVersion: event.target.value })
                    }
                    className="field"
                  />
                </label>
              </div>
            </section>
            <section className="rounded-xl border border-[#30363d] bg-[#111820]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#30363d] p-3">
                <div>
                  <h2 className="text-sm font-semibold">通道配置</h2>
                  <p className="text-[9px] text-gray-600">
                    通信调试和集成测试共享这些配置
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {(["serial", "tcp", "udp", "websocket"] as const).map(
                    (kind) => (
                      <button
                        key={kind}
                        onClick={() => addChannel(kind)}
                        className="rounded border border-[#30363d] px-2 py-1 text-[10px] text-gray-400"
                      >
                        <Plus size={10} className="mr-1 inline" />
                        {kind === "serial" ? "串口" : kind.toUpperCase()}
                      </button>
                    ),
                  )}
                </div>
              </div>
              <div className="grid gap-2 p-3">
                {device.channels.map((channel) => (
                  <article
                    key={channel.id}
                    className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      {channel.kind === "serial" ? (
                        <Usb size={14} className="text-green-400" />
                      ) : (
                        <Radio size={14} className="text-blue-400" />
                      )}
                      <input
                        value={channel.name}
                        onChange={(event) =>
                          updateChannel(channel.id, {
                            name: event.target.value,
                          })
                        }
                        className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none"
                      />
                      <label className="text-[10px] text-gray-500">
                        <input
                          type="checkbox"
                          checked={channel.autoConnect}
                          onChange={(event) =>
                            updateChannel(channel.id, {
                              autoConnect: event.target.checked,
                            })
                          }
                        />
                        自动连接
                      </label>
                      <button
                        onClick={() => removeChannel(channel.id)}
                        className="text-red-400"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {channel.kind === "serial" && channel.serial ? (
                      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                        <label className="text-[9px] text-gray-600">
                          端口
                          <select
                            value={channel.serial.path}
                            onChange={(event) =>
                              updateChannel(channel.id, {
                                serial: {
                                  ...channel.serial!,
                                  path: event.target.value,
                                },
                              })
                            }
                            className="field"
                          >
                            <option value="">自动/未选择</option>
                            {ports.map((port) => (
                              <option key={port.path}>{port.path}</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-[9px] text-gray-600">
                          波特率
                          <input
                            type="number"
                            value={channel.serial.baudRate}
                            onChange={(event) =>
                              updateChannel(channel.id, {
                                serial: {
                                  ...channel.serial!,
                                  baudRate: Number(event.target.value),
                                },
                              })
                            }
                            className="field"
                          />
                        </label>
                        <label className="text-[9px] text-gray-600">
                          数据位
                          <select
                            value={channel.serial.dataBits}
                            onChange={(event) =>
                              updateChannel(channel.id, {
                                serial: {
                                  ...channel.serial!,
                                  dataBits: Number(event.target.value),
                                },
                              })
                            }
                            className="field"
                          >
                            <option>7</option>
                            <option>8</option>
                          </select>
                        </label>
                        <label className="text-[9px] text-gray-600">
                          停止位
                          <select
                            value={channel.serial.stopBits}
                            onChange={(event) =>
                              updateChannel(channel.id, {
                                serial: {
                                  ...channel.serial!,
                                  stopBits: Number(event.target.value),
                                },
                              })
                            }
                            className="field"
                          >
                            <option>1</option>
                            <option>2</option>
                          </select>
                        </label>
                        <label className="text-[9px] text-gray-600">
                          校验
                          <select
                            value={channel.serial.parity}
                            onChange={(event) =>
                              updateChannel(channel.id, {
                                serial: {
                                  ...channel.serial!,
                                  parity: event.target
                                    .value as typeof channel.serial.parity,
                                },
                              })
                            }
                            className="field"
                          >
                            <option value="none">None</option>
                            <option value="even">Even</option>
                            <option value="odd">Odd</option>
                          </select>
                        </label>
                        <label className="text-[9px] text-gray-600">
                          组帧
                          <select
                            value={channel.serial.frameMode}
                            onChange={(event) =>
                              updateChannel(channel.id, {
                                serial: {
                                  ...channel.serial!,
                                  frameMode: event.target
                                    .value as typeof channel.serial.frameMode,
                                },
                              })
                            }
                            className="field"
                          >
                            <option value="auto">自动</option>
                            <option value="line">换行符</option>
                            <option value="idle">空闲间隔</option>
                            <option value="raw">原始块</option>
                          </select>
                        </label>
                      </div>
                    ) : channel.kind === "websocket" ? (
                      <label className="block text-[9px] text-gray-600">
                        地址
                        <input
                          value={channel.websocketUrl ?? ""}
                          onChange={(event) =>
                            updateChannel(channel.id, {
                              websocketUrl: event.target.value,
                            })
                          }
                          className="field"
                        />
                      </label>
                    ) : (
                      channel.network && (
                        <div className="grid gap-2 sm:grid-cols-4">
                          <label className="text-[9px] text-gray-600">
                            角色
                            <select
                              value={channel.network.role}
                              onChange={(event) =>
                                updateChannel(channel.id, {
                                  network: {
                                    ...channel.network!,
                                    role: event.target.value as
                                      "client" | "server",
                                  },
                                })
                              }
                              className="field"
                            >
                              <option value="client">客户端</option>
                              <option value="server">服务端</option>
                            </select>
                          </label>
                          <label className="text-[9px] text-gray-600">
                            主机
                            <input
                              value={channel.network.host}
                              onChange={(event) =>
                                updateChannel(channel.id, {
                                  network: {
                                    ...channel.network!,
                                    host: event.target.value,
                                  },
                                })
                              }
                              className="field"
                            />
                          </label>
                          <label className="text-[9px] text-gray-600">
                            端口
                            <input
                              type="number"
                              value={channel.network.port}
                              onChange={(event) =>
                                updateChannel(channel.id, {
                                  network: {
                                    ...channel.network!,
                                    port: Number(event.target.value),
                                  },
                                })
                              }
                              className="field"
                            />
                          </label>
                          <label className="text-[9px] text-gray-600">
                            本地端口
                            <input
                              type="number"
                              value={channel.network.localPort}
                              onChange={(event) =>
                                updateChannel(channel.id, {
                                  network: {
                                    ...channel.network!,
                                    localPort: Number(event.target.value),
                                  },
                                })
                              }
                              className="field"
                            />
                          </label>
                        </div>
                      )
                    )}
                  </article>
                ))}
              </div>
            </section>
          </main>
        )}
      </div>
    </div>
  );
}
