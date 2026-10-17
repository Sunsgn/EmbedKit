import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleStop,
  Copy,
  Download,
  FileUp,
  FlaskConical,
  History,
  Play,
  Plus,
  Save,
  Trash2,
  Usb,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { getAgentStatus } from "../services/agentClient";
import {
  closeNetworkSession,
  openNetworkSession,
  readNetworkSession,
  sendNetworkData,
} from "../services/networkAgent";
import {
  closeSerialSession,
  listSerialPorts,
  listSerialSessions,
  openSerialSession,
  readSerialSession,
  sendSerialData,
  type SerialAgentPort,
  type SerialAgentSession,
} from "../services/serialAgent";
import {
  deleteTestRun,
  listBuildArtifacts,
  listFirmwareIdentities,
  listTestRuns,
  saveTestRunWithCommunicationSessions,
} from "../services/productStorage";
import {
  createTestRunEvidence,
  createTestRunJsonReport,
  TEST_RUN_OBSERVED_LIMIT,
} from "../services/testRunEvidence";
import { listBuildAnalysisRecords } from "../services/buildAnalysisRecords";
import { createFirmwareCatalog } from "../services/firmwareIdentity";
import { createCommunicationSessionRecords, type ArchivedCommunicationEvidence } from "../services/communicationArchive";
import { compareTestRuns, type RunComparisonOutcome } from "../services/testRunComparison";
import { createConfigurationFingerprint } from "../services/configurationFingerprint";
import { clearSerialTestSessionHandoff, readSerialTestSessionHandoff, type SerialTestSessionHandoff } from "../services/testSessionHandoff";
import type { TestRunRecord, TestStepRun } from "../types/product";
import { formatHex, parseHexBytes } from "../utils/embeddedTools";
import {
  applySharedFlowChannel,
  cleanupFlowResources,
  moveFlowStep as reorderFlowStep,
  orderedFlowSteps,
  removeFlowStep,
  requiredFlowChannels,
  resolvedFlowStep,
  sharedFlowChannel,
  stepUsesChannel,
} from "../utils/testFlow";

type Channel = "serial-a" | "serial-b" | "websocket" | "tcp" | "udp";
interface FirmwareChoice {
  id: string;
  firmwareId?: string;
  buildId: string;
  fileName: string;
  artifactType: string;
  size: number;
  modifiedAt: string;
  sha256: string;
  analyzedAt: string;
}
type StepType =
  | "command"
  | "send"
  | "wait"
  | "match"
  | "delay"
  | "wait-online"
  | "clear-buffer"
  | "set-variable"
  | "manual";
type StepStatus = "idle" | "running" | "passed" | "failed" | "skipped";
type StepStage = "setup" | "test" | "teardown";
type LineEnding = "none" | "cr" | "lf" | "crlf";
interface TestStep {
  id: string;
  name: string;
  type: StepType;
  stage?: StepStage;
  channel: Channel;
  data: string;
  hex: boolean;
  durationMs: number;
  timeoutMs: number;
  retryCount: number;
  matchMode: "contains" | "equals" | "regex";
  expected?: string;
  failurePattern?: string;
  captureName?: string;
  captureRegex?: string;
  onFailure?: "stop" | "continue";
  lineEnding?: LineEnding;
}
interface TestCase {
  id: string;
  name: string;
  steps: TestStep[];
  sharedChannel?: boolean;
  channel?: Channel;
  lineEnding?: LineEnding;
}
interface FlowVariable {
  id: string;
  name: string;
  value: string;
  secret: boolean;
}
interface TestSuite {
  id: string;
  name: string;
  cases: TestCase[];
  variables?: FlowVariable[];
}
interface RunLog {
  id: number;
  time: string;
  level: "info" | "pass" | "fail" | "rx" | "tx";
  text: string;
}
interface Incoming {
  channel: Channel;
  text: string;
  hex: string;
}
type SessionEvidence = ArchivedCommunicationEvidence;
interface SerialRuntime {
  id: string;
  after: number;
  path: string;
  polling: boolean;
}
interface SerialConnectionConfig {
  path: string;
  baudRate: number;
  dataBits: 7 | 8;
  stopBits: 1 | 2;
  parity: "none" | "even" | "odd";
  flowControl: "none" | "hardware";
}
interface NetworkConfig {
  mode: "client" | "server";
  host: string;
  port: string;
  localPort: string;
}

const STORAGE_KEY = "embedkit.automation.suites";
const SERIAL_CONFIG_KEY = "embedkit.automation.serial-config.v1";
const defaultSerialConnection = (): SerialConnectionConfig => ({
  path: "",
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: "none",
  flowControl: "none",
});
const loadSerialConfigs = (): Record<"serial-a" | "serial-b", SerialConnectionConfig> => {
  const fallback = { "serial-a": defaultSerialConnection(), "serial-b": defaultSerialConnection() };
  try {
    const saved = JSON.parse(localStorage.getItem(SERIAL_CONFIG_KEY) ?? "null") as Partial<Record<"serial-a" | "serial-b", Partial<SerialConnectionConfig>>> | null;
    if (!saved) return fallback;
    for (const channel of ["serial-a", "serial-b"] as const) {
      const value = saved[channel];
      if (!value) continue;
      fallback[channel] = {
        path: typeof value.path === "string" ? value.path.slice(0, 260) : "",
        baudRate: Number.isInteger(value.baudRate) && Number(value.baudRate) >= 50 && Number(value.baudRate) <= 4_000_000 ? Number(value.baudRate) : 115200,
        dataBits: value.dataBits === 7 ? 7 : 8,
        stopBits: value.stopBits === 2 ? 2 : 1,
        parity: value.parity === "even" || value.parity === "odd" ? value.parity : "none",
        flowControl: value.flowControl === "hardware" ? "hardware" : "none",
      };
    }
  } catch { /* damaged preferences fall back without blocking test editing */ }
  return fallback;
};
const channelLabels: Record<Channel, string> = {
  "serial-a": "串口 A",
  "serial-b": "串口 B",
  websocket: "WebSocket",
  tcp: "TCP",
  udp: "UDP",
};
const comparisonLabels: Record<RunComparisonOutcome, string> = {
  fixed: '复测通过，候选修复有效',
  regressed: '出现回归',
  'unchanged-pass': '持续通过',
  'unchanged-fail': '问题仍可复现',
  changed: '结果发生变化',
  incomparable: '上下文不同，不能比较',
};
const typeLabels: Record<StepType, string> = {
  command: "发送并断言",
  send: "发送数据",
  wait: "等待响应",
  match: "匹配响应",
  delay: "延时",
  "wait-online": "等待通道在线",
  "clear-buffer": "清空接收缓冲",
  "set-variable": "设置变量",
  manual: "人工确认",
};
const typeColors: Record<StepType, string> = {
  command: "text-cyan-300 bg-cyan-500/10",
  send: "text-blue-400 bg-blue-500/10",
  wait: "text-yellow-400 bg-yellow-500/10",
  match: "text-green-400 bg-green-500/10",
  delay: "text-purple-400 bg-purple-500/10",
  "wait-online": "text-orange-300 bg-orange-500/10",
  "clear-buffer": "text-gray-300 bg-gray-500/10",
  "set-variable": "text-pink-300 bg-pink-500/10",
  manual: "text-amber-300 bg-amber-500/10",
};
const stageLabels: Record<StepStage, string> = {
  setup: "前置",
  test: "测试",
  teardown: "清理",
};
const lineEndingLabels: Record<LineEnding, string> = {
  none: "不追加",
  crlf: "回车换行（CRLF）",
  cr: "仅回车（CR）",
  lf: "仅换行（LF）",
};
const isLineEnding = (value: unknown): value is LineEnding =>
  value === "none" || value === "crlf" || value === "cr" || value === "lf";
const createStep = (type: StepType = "command"): TestStep => ({
  id: crypto.randomUUID(),
  name: typeLabels[type],
  type,
  stage: "test",
  channel: "serial-a",
  data:
    type === "command"
      ? "AT"
      : type === "match"
        ? "OK"
        : type === "manual"
          ? "请确认设备状态正常后继续"
          : "",
  expected: type === "command" ? "OK" : "",
  failurePattern: "ERROR|FAIL",
  captureName: type === "set-variable" ? "VARIABLE" : "",
  captureRegex: "",
  onFailure: "stop",
  hex: false,
  durationMs: 500,
  timeoutMs: 3000,
  retryCount: type === "command" ? 1 : 0,
  matchMode: "contains",
});
const createAtNetworkCase = (): TestCase => {
  const command = (
    name: string,
    data: string,
    expected = "OK",
    timeoutMs = 3000,
    extra: Partial<TestStep> = {},
  ): TestStep => ({
    ...createStep("command"),
    name,
    data,
    expected,
    timeoutMs,
    ...extra,
  });
  return {
    id: crypto.randomUUID(),
    name: "ESP-AT 模组联网流程",
    sharedChannel: true,
    channel: "serial-a",
    lineEnding: "crlf",
    steps: [
      command("检测模组", "AT"),
      command("关闭指令回显", "ATE0"),
      command("设置 Station 模式", "AT+CWMODE=1"),
      command(
        "连接 Wi-Fi",
        'AT+CWJAP="{{SSID}}","{{PASSWORD}}"',
        "WIFI GOT IP|OK",
        20000,
        { matchMode: "regex", retryCount: 2 },
      ),
      command("读取并保存 IP 地址", "AT+CIFSR", "STAIP,", 5000, {
        captureName: "DEVICE_IP",
        captureRegex: 'STAIP,"([^"]+)"',
      }),
    ],
  };
};
const defaultSuites = (): TestSuite[] => [
  {
    id: crypto.randomUUID(),
    name: "设备通信测试",
    variables: [],
    cases: [
      {
        id: crypto.randomUUID(),
        name: "启动与响应",
        sharedChannel: true,
        channel: "serial-a",
        lineEnding: "none",
        steps: [createStep("command")],
      },
    ],
  },
];
function loadSuites() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as
      TestSuite[] | null;
    return value?.length ? value : defaultSuites();
  } catch {
    return defaultSuites();
  }
}
const sleep = (ms: number) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));
const resolveVariables = (value: string, variables: FlowVariable[] = []) =>
  value.replace(
    /\{\{([A-Za-z_][\w]*)\}\}/g,
    (token, name: string) =>
      variables.find((item) => item.name === name)?.value ?? token,
  );
const applyLineEnding = (value: string, lineEnding: LineEnding = "none") =>
  lineEnding === "none"
    ? value
    : `${value.replace(/(?:\r\n|\r|\n)$/, "")}${lineEnding === "crlf" ? "\r\n" : lineEnding === "cr" ? "\r" : "\n"}`;

export default function TestAutomationPage() {
  const [suites, setSuites] = useState<TestSuite[]>(loadSuites);
  const [selectedSuiteId, setSelectedSuiteId] = useState(() => suites[0].id);
  const [selectedCaseId, setSelectedCaseId] = useState(
    () => suites[0].cases[0].id,
  );
  const [selectedStepId, setSelectedStepId] = useState(
    () => suites[0].cases[0].steps[0]?.id ?? "",
  );
  const [statuses, setStatuses] = useState<Record<string, StepStatus>>({});
  const [runLogs, setRunLogs] = useState<RunLog[]>([]);
  const [running, setRunning] = useState(false);
  const [manualConfirmation, setManualConfirmation] = useState<{
    message: string;
    resolve: (approved: boolean) => void;
  } | null>(null);
  const [serialNames, setSerialNames] = useState<
    Partial<Record<Channel, string>>
  >({});
  const [serialChoices, setSerialChoices] = useState<SerialAgentSession[]>([]),
    [serialSelection, setSerialSelection] = useState<
      Partial<Record<"serial-a" | "serial-b", string>>
    >({}),
    [serialPorts, setSerialPorts] = useState<SerialAgentPort[]>([]),
    [serialConfigs, setSerialConfigs] = useState(loadSerialConfigs),
    [serialSetupOpen, setSerialSetupOpen] = useState<Record<"serial-a" | "serial-b", boolean>>({
      "serial-a": false,
      "serial-b": false,
    }),
    [serialBusy, setSerialBusy] = useState<"serial-a" | "serial-b" | "refresh" | null>(null),
    [serialMessage, setSerialMessage] = useState(""),
    [serialHandoff, setSerialHandoff] = useState<SerialTestSessionHandoff | null>(null);
  const [wsUrl, setWsUrl] = useState("ws://127.0.0.1:8080");
  const [networkConfigs, setNetworkConfigs] = useState<
    Record<"tcp" | "udp", NetworkConfig>
  >({
    tcp: { mode: "client", host: "127.0.0.1", port: "9000", localPort: "0" },
    udp: { mode: "client", host: "127.0.0.1", port: "9000", localPort: "0" },
  });
  const [, setLastResult] = useState<{
    passed: number;
    failed: number;
    duration: number;
    caseName: string;
  } | null>(null);
  const [runHistory, setRunHistory] = useState<TestRunRecord[]>([]),
    [showHistory, setShowHistory] = useState(false),
    [agentVersion, setAgentVersion] = useState("unknown"),
    [firmwareChoices, setFirmwareChoices] = useState<FirmwareChoice[]>(() =>
      listBuildAnalysisRecords().filter((item) => item.status === 'passed' && /^[0-9a-f]{64}$/i.test(item.sha256 ?? '')).map(item => ({ ...item, sha256: item.sha256!.toLowerCase() })),
    ),
    [selectedFirmwareId, setSelectedFirmwareId] = useState(""),
    [baselineRunId, setBaselineRunId] = useState("");
  const logSeq = useRef(0),
    stopRequested = useRef(false),
    executingTeardown = useRef(false),
    incoming = useRef<Incoming[]>([]),
    cursors = useRef<Partial<Record<Channel, number>>>({}),
    runtimeVariables = useRef<FlowVariable[]>([]),
    runLogsRef = useRef<RunLog[]>([]),
    sessionEvidence = useRef(new Map<Channel, SessionEvidence>());
  const serials = useRef(new Map<Channel, SerialRuntime>()),
    ownedSerialSessionIds = useRef(new Set<string>()),
    ws = useRef<WebSocket | null>(null),
    agentSessions = useRef(new Map<Channel, { id: string; after: number }>());
  const selectedSuite =
    suites.find((item) => item.id === selectedSuiteId) ?? suites[0];
  const selectedCase =
    selectedSuite?.cases.find((item) => item.id === selectedCaseId) ??
    selectedSuite?.cases[0];
  const selectedStep =
    selectedCase?.steps.find((item) => item.id === selectedStepId) ?? null;
  const runComparison = useMemo(() => {
    const current = runHistory[0], baselineId = current?.baselineRunId || baselineRunId;
    if (!current || !baselineId || current.id === baselineId) return null;
    const baseline = runHistory.find(item => item.id === baselineId);
    return baseline ? compareTestRuns(baseline, current) : null;
  }, [baselineRunId, runHistory]);

  const refreshSerialResources = useCallback(async (report = true) => {
    if (report) { setSerialBusy("refresh"); setSerialMessage("正在读取本机串口…"); }
    try {
      const [ports, sessions] = await Promise.all([listSerialPorts(), listSerialSessions()]),
        connected = sessions.filter((item) => item.state === "connected");
      setSerialPorts(ports);
      setSerialChoices(connected);
      const handoff = readSerialTestSessionHandoff();
      let handoffProblem = "";
      if (handoff) {
        if (connected.some(item => item.id === handoff.sessionId)) setSerialHandoff(handoff);
        else {
          clearSerialTestSessionHandoff(handoff.id);
          setSerialHandoff(null);
          handoffProblem = `来自通信调试的 ${handoff.path} 会话已失效，请重新连接或选择其他串口`;
          setSerialMessage(handoffProblem);
        }
      } else {
        setSerialHandoff(null);
        if (!report && window.location.hash.includes("handoff=serial")) setSerialMessage("通信调试会话交接已过期或无效，请重新发起");
      }
      setSerialSelection((previous) => ({
        "serial-a": connected.some(item => item.id === previous["serial-a"]) ? previous["serial-a"] : undefined,
        "serial-b": connected.some(item => item.id === previous["serial-b"]) ? previous["serial-b"] : undefined,
      }));
      setSerialConfigs(previous => {
        const next = { ...previous };
        for (const channel of ["serial-a", "serial-b"] as const) {
          if (!next[channel].path && ports.length) next[channel] = { ...next[channel], path: ports[0].path };
        }
        return next;
      });
      if (report && !handoffProblem) setSerialMessage(`发现 ${ports.length} 个真实串口，${connected.length} 个已连接会话`);
    } catch (reason) {
      setSerialPorts([]);
      setSerialChoices([]);
      if (report) setSerialMessage(`串口枚举失败：${reason instanceof Error ? reason.message : String(reason)}`);
    } finally {
      if (report) setSerialBusy(null);
    }
  }, []);

  useEffect(() => {
    const safeSuites = suites.map((suite) => ({
      ...suite,
      variables: suite.variables?.map((variable) =>
        variable.secret ? { ...variable, value: "" } : variable,
      ),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeSuites));
  }, [suites]);
  useEffect(() => {
    localStorage.setItem(SERIAL_CONFIG_KEY, JSON.stringify(serialConfigs));
  }, [serialConfigs]);
  useEffect(() => {
    void Promise.all([
      listTestRuns(),
      getAgentStatus().catch(() => null),
      listBuildArtifacts(),
      listFirmwareIdentities(),
    ]).then(([runs, status, artifacts, identities]) => {
      setRunHistory(runs);
      const lifecycleFirmware = createFirmwareCatalog(artifacts, identities).map(item => ({ ...item, modifiedAt: item.capturedAt, analyzedAt: item.capturedAt }));
      setFirmwareChoices(current => [...lifecycleFirmware, ...current.filter(item => !lifecycleFirmware.some(saved => saved.sha256 === item.sha256 && saved.buildId === item.buildId))]);
      setAgentVersion(
        (status as { version?: string } | null)?.version ?? "unknown",
      );
    });
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void refreshSerialResources(false), 0);
    return () => window.clearTimeout(timer);
  }, [refreshSerialResources]);
  const addRunLog = useCallback((level: RunLog["level"], text: string) => {
    const date = new Date(),
      pad = (value: number, length = 2) => String(value).padStart(length, "0"),
      entry = {
        id: ++logSeq.current,
        time: `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`,
        level,
        text,
      };
    runLogsRef.current = [...runLogsRef.current, entry].slice(-1000);
    setRunLogs(runLogsRef.current);
  }, []);
  const pushIncoming = useCallback(
    (channel: Channel, bytes: Uint8Array, text?: string) => {
      const value = text ?? new TextDecoder().decode(bytes);
      incoming.current.push({ channel, text: value, hex: formatHex(bytes) });
      const evidence = sessionEvidence.current.get(channel);
      if (evidence) evidence.rxBytes += bytes.byteLength;
      addRunLog(
        "rx",
        `${channelLabels[channel]} ← ${value || formatHex(bytes)}`,
      );
    },
    [addRunLog],
  );

  const releaseResources = useCallback(async (stop: boolean, report: boolean) => {
    if (stop) stopRequested.current = true;
    const socket = ws.current,
      sessions = [...agentSessions.current.entries()],
      ownedSerialIds = [...ownedSerialSessionIds.current];
    ws.current = null;
    for (const runtime of serials.current.values()) runtime.polling = false;
    serials.current.clear();
    agentSessions.current.clear();
    if (report) setSerialNames({});
    const failures = await cleanupFlowResources([
      ...ownedSerialIds.map((id) => ({
        name: `串口 ${id.slice(0, 8)}`,
        run: async () => { await closeSerialSession(id); },
      })),
      ...(socket
        ? [{ name: "WebSocket", run: () => socket.close() }]
        : []),
      ...sessions.map(([channel, item]) => ({
        name: channel.toUpperCase(),
        run: async () => {
          await closeNetworkSession(item.id);
        },
      })),
    ]);
    const failedNames = new Set(failures.map(item => item.name)),
      closedSerialIds = ownedSerialIds.filter(id => !failedNames.has(`串口 ${id.slice(0, 8)}`));
    for (const id of closedSerialIds) ownedSerialSessionIds.current.delete(id);
    if (report) {
      if (closedSerialIds.length) {
        setSerialChoices(previous => previous.filter(item => !closedSerialIds.includes(item.id)));
        setSerialSelection(previous => ({
          "serial-a": previous["serial-a"] && !closedSerialIds.includes(previous["serial-a"]!) ? previous["serial-a"] : undefined,
          "serial-b": previous["serial-b"] && !closedSerialIds.includes(previous["serial-b"]!) ? previous["serial-b"] : undefined,
        }));
      }
      if (failures.length)
        failures.forEach((failure) =>
          addRunLog("fail", `${failure.name} 资源清理失败：${failure.error}`),
        );
      else if (socket || sessions.length || ownedSerialIds.length) {
        const releasedKinds = [ownedSerialIds.length ? "串口" : "", socket || sessions.length ? "网络" : ""].filter(Boolean).join("和");
        addRunLog("pass", `测试创建的${releasedKinds}资源已释放`);
      }
    }
    return failures;
  }, [addRunLog]);
  const closeResources = useCallback(
    async () => releaseResources(true, false),
    [releaseResources],
  );
  useEffect(
    () => () => {
      void closeResources();
    },
    [closeResources],
  );

  const startSerialReader = useCallback(
    (channel: Channel, runtime: SerialRuntime) => {
      runtime.polling = true;
      void (async () => {
        while (runtime.polling && serials.current.get(channel) === runtime) {
          try {
            const session = await readSerialSession(runtime.id, runtime.after);
            for (const event of session.events) {
              runtime.after = Math.max(runtime.after, event.id);
              if (event.direction === "rx")
                pushIncoming(
                  channel,
                  event.hex
                    ? parseHexBytes(event.hex)
                    : new TextEncoder().encode(event.text),
                  event.text,
                );
            }
          } catch (reason) {
            addRunLog(
              "fail",
              `${channelLabels[channel]}读取失败：${reason instanceof Error ? reason.message : String(reason)}`,
            );
            runtime.polling = false;
            break;
          }
          await sleep(100);
        }
      })();
    },
    [addRunLog, pushIncoming],
  );
  const attachSerialSession = async (channel: "serial-a" | "serial-b", selected: SerialAgentSession, owned: boolean) => {
    const old = serials.current.get(channel);
    if (old) old.polling = false;
    if (old && old.id !== selected.id && ownedSerialSessionIds.current.has(old.id)) {
      const usedElsewhere = [...serials.current.entries()].some(([otherChannel, runtime]) => otherChannel !== channel && runtime.id === old.id);
      if (!usedElsewhere) {
        await closeSerialSession(old.id);
        ownedSerialSessionIds.current.delete(old.id);
      }
    }
    if (owned) ownedSerialSessionIds.current.add(selected.id);
    const runtime = {
      id: selected.id,
      after: selected.events[selected.events.length - 1]?.id ?? 0,
      path: selected.path,
      polling: false,
    };
    serials.current.set(channel, runtime);
    setSerialSetupOpen(previous => ({ ...previous, [channel]: false }));
    sessionEvidence.current.set(channel, {
      channel,
      transport: "serial",
      sessionId: selected.id,
      endpoint: selected.path,
      rxBytes: 0,
      txBytes: 0,
      startedAt: new Date().toISOString(),
    });
    setSerialNames((previous) => ({ ...previous, [channel]: `${selected.path} · ${selected.baudRate} baud` }));
    setSerialSelection(previous => ({ ...previous, [channel]: selected.id }));
    startSerialReader(channel, runtime);
  };
  const bindSerial = async (channel: "serial-a" | "serial-b") => {
    try {
      const sessions = (await listSerialSessions()).filter(
        (item) => item.state === "connected",
      );
      setSerialChoices(sessions);
      const selected = sessions.find((item) => item.id === serialSelection[channel]);
      if (!selected) throw new Error("请选择一个已连接串口会话，或直接连接下方真实串口");
      await attachSerialSession(channel, selected, ownedSerialSessionIds.current.has(selected.id));
      setSerialMessage(`${channelLabels[channel]}正在复用 ${selected.path}，测试结束不会关闭外部会话`);
      addRunLog("pass", `${channelLabels[channel]}已共享 ${selected.path}`);
    } catch (reason) {
      setSerialMessage(`串口绑定失败：${reason instanceof Error ? reason.message : String(reason)}`);
      addRunLog(
        "fail",
        `串口绑定失败：${reason instanceof Error ? reason.message : String(reason)}`,
      );
    }
  };
  const connectSerial = async (channel: "serial-a" | "serial-b") => {
    const config = serialConfigs[channel];
    setSerialBusy(channel);
    try {
      if (!config.path || !serialPorts.some(port => port.path === config.path)) throw new Error("请刷新并选择一个当前可用的真实串口");
      const selected = await openSerialSession(config), owned = selected.reused !== true;
      await attachSerialSession(channel, selected, owned || ownedSerialSessionIds.current.has(selected.id));
      setSerialChoices(previous => [...previous.filter(item => item.id !== selected.id), selected]);
      setSerialMessage(`${channelLabels[channel]}已连接 ${selected.path} · ${selected.baudRate} baud${selected.reused ? "（复用已有会话）" : "（本页创建，测试结束自动关闭）"}`);
      addRunLog("pass", `${channelLabels[channel]}已连接 ${selected.path}`);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setSerialMessage(`${channelLabels[channel]}连接失败：${message}`);
      addRunLog("fail", `${channelLabels[channel]}连接失败：${message}`);
    } finally {
      setSerialBusy(null);
    }
  };
  const acceptSerialHandoff = async (channel: "serial-a" | "serial-b") => {
    if (!serialHandoff) return;
    setSerialBusy(channel);
    try {
      const selected = (await listSerialSessions()).find(item => item.id === serialHandoff.sessionId && item.state === "connected");
      if (!selected) throw new Error("原串口会话已经断开");
      await attachSerialSession(channel, selected, false);
      clearSerialTestSessionHandoff(serialHandoff.id);
      setSerialHandoff(null);
      setSerialChoices(previous => [...previous.filter(item => item.id !== selected.id), selected]);
      setSerialMessage(`已将通信调试的 ${selected.path} 绑定到${channelLabels[channel]}；测试结束不会关闭该共享会话`);
      addRunLog("pass", `${channelLabels[channel]}已接收通信调试会话 ${selected.path}`);
    } catch (reason) {
      clearSerialTestSessionHandoff(serialHandoff.id);
      setSerialHandoff(null);
      setSerialMessage(`会话交接失败：${reason instanceof Error ? reason.message : String(reason)}；请重新连接或直接选择串口`);
    } finally {
      setSerialBusy(null);
    }
  };
  const cancelSerialHandoff = () => {
    if (serialHandoff) clearSerialTestSessionHandoff(serialHandoff.id);
    setSerialHandoff(null);
    setSerialMessage("已取消通信调试会话交接");
  };
  const unbindSerial = async (channel: "serial-a" | "serial-b") => {
    const runtime = serials.current.get(channel);
    if (!runtime) return;
    runtime.polling = false;
    serials.current.delete(channel);
    sessionEvidence.current.delete(channel);
    setSerialNames(previous => ({ ...previous, [channel]: undefined }));
    const owned = ownedSerialSessionIds.current.has(runtime.id),
      usedElsewhere = [...serials.current.values()].some(item => item.id === runtime.id);
    if (owned && !usedElsewhere) {
      try {
        await closeSerialSession(runtime.id);
        ownedSerialSessionIds.current.delete(runtime.id);
        setSerialChoices(previous => previous.filter(item => item.id !== runtime.id));
        setSerialSelection(previous => ({ ...previous, [channel]: undefined }));
        setSerialMessage(`${channelLabels[channel]}已断开 ${runtime.path}`);
      } catch (reason) {
        setSerialMessage(`${channelLabels[channel]}关闭失败：${reason instanceof Error ? reason.message : String(reason)}`);
      }
    } else setSerialMessage(`${channelLabels[channel]}已解除绑定；共享会话保持连接`);
    setSerialSetupOpen(previous => ({ ...previous, [channel]: true }));
  };

  const ensureWebSocket = async () => {
    if (ws.current?.readyState === WebSocket.OPEN) return ws.current;
    return await new Promise<WebSocket>((resolve, reject) => {
      const socket = new WebSocket(wsUrl);
      socket.binaryType = "arraybuffer";
      const timer = window.setTimeout(() => {
        socket.close();
        reject(new Error("WebSocket 连接超时"));
      }, 5000);
      socket.onopen = () => {
        window.clearTimeout(timer);
        ws.current = socket;
        sessionEvidence.current.set("websocket", {
          channel: "websocket",
          transport: "websocket",
          sessionId: crypto.randomUUID(),
          endpoint: wsUrl,
          rxBytes: 0,
          txBytes: 0,
          startedAt: new Date().toISOString(),
        });
        addRunLog("pass", `WebSocket 已连接 ${wsUrl}`);
        resolve(socket);
      };
      socket.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer)
          pushIncoming("websocket", new Uint8Array(event.data));
        else {
          const text = String(event.data);
          pushIncoming("websocket", new TextEncoder().encode(text), text);
        }
      };
      socket.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error("WebSocket 连接失败"));
      };
      socket.onclose = () => {
        if (ws.current === socket) ws.current = null;
      };
    });
  };
  const ensureAgent = async (channel: "tcp" | "udp") => {
    const existing = agentSessions.current.get(channel);
    if (existing) return existing;
    const config = networkConfigs[channel],
      result = await openNetworkSession({
        type: channel,
        mode: config.mode,
        host: config.host,
        port: Number(config.port),
        localPort: Number(config.localPort),
      });
    const runtime = { id: result.id, after: 0 };
    agentSessions.current.set(channel, runtime);
    sessionEvidence.current.set(channel, {
      channel,
      transport: channel,
      sessionId: result.id,
      endpoint: `${config.mode}:${config.host}:${config.port}`,
      rxBytes: 0,
      txBytes: 0,
      startedAt: new Date().toISOString(),
    });
    addRunLog(
      "pass",
      `${channel.toUpperCase()} ${config.mode === "server" ? "已监听" : "已连接"} ${config.host}:${config.port}`,
    );
    return runtime;
  };
  const pollAgent = async (channel: "tcp" | "udp") => {
    const runtime = await ensureAgent(channel);
    const result = await readNetworkSession(runtime.id, runtime.after);
    for (const event of result.events) {
      runtime.after = Math.max(runtime.after, event.id);
      if (event.direction === "rx") {
        const bytes = event.hex
          ? parseHexBytes(event.hex)
          : new TextEncoder().encode(event.text);
        pushIncoming(channel, bytes, event.text);
      }
    }
  };
  const ensureChannel = async (channel: Channel) => {
    if (channel === "serial-a" || channel === "serial-b") {
      if (!serials.current.has(channel))
        throw new Error(`${channelLabels[channel]}尚未绑定`);
      return;
    }
    if (channel === "websocket") await ensureWebSocket();
    else await ensureAgent(channel);
  };
  const sendData = async (step: TestStep) => {
    await ensureChannel(step.channel);
    const resolved = resolveVariables(step.data, runtimeVariables.current),
      data = step.hex
        ? resolved
        : applyLineEnding(
            resolved,
            isLineEnding(step.lineEnding)
              ? step.lineEnding
              : isLineEnding(selectedCase?.lineEnding)
                ? selectedCase.lineEnding
                : "none",
          );
    const bytes = step.hex
      ? parseHexBytes(data)
      : new TextEncoder().encode(data);
    if (step.channel === "serial-a" || step.channel === "serial-b") {
      const runtime = serials.current.get(step.channel);
      if (!runtime) throw new Error("串口尚未绑定");
      await sendSerialData(
        runtime.id,
        step.hex ? data : new TextDecoder().decode(bytes),
        step.hex ? "hex" : "text",
      );
    } else if (step.channel === "websocket") {
      if (step.hex) {
        const binary = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(binary).set(bytes);
        (await ensureWebSocket()).send(binary);
      } else (await ensureWebSocket()).send(data);
    } else {
      const runtime = await ensureAgent(step.channel);
      await sendNetworkData(runtime.id, data, step.hex ? "hex" : "text");
    }
    const evidence = sessionEvidence.current.get(step.channel);
    if (evidence) evidence.txBytes += bytes.byteLength;
    addRunLog("tx", `${channelLabels[step.channel]} → ${step.data}`);
  };
  const waitForInput = async (
    step: TestStep,
    shouldMatch: boolean,
    expectedValue = step.data,
    failureValue = "",
  ): Promise<string> => {
    await ensureChannel(step.channel);
    const expected = resolveVariables(expectedValue, runtimeVariables.current),
      failure = resolveVariables(failureValue, runtimeVariables.current),
      started = Date.now(),
      cursor = cursors.current[step.channel] ?? 0;
    while (Date.now() - started < Math.max(100, step.timeoutMs)) {
      if (stopRequested.current && !executingTeardown.current)
        throw new Error("执行已停止");
      if (step.channel === "tcp" || step.channel === "udp")
        await pollAgent(step.channel);
      const candidates = incoming.current
        .slice(cursor)
        .map((item, offset) => ({ item, index: cursor + offset }))
        .filter((value) => value.item.channel === step.channel);
      if (candidates.length) {
        if (!shouldMatch) {
          cursors.current[step.channel] = candidates[0].index + 1;
          return step.hex ? candidates[0].item.hex : candidates[0].item.text;
        }
        const sources = candidates.map(({ item }) =>
            step.hex ? item.hex : item.text,
          ),
          combined = sources.join(step.hex ? " " : "");
        if (failure && new RegExp(failure, "i").test(combined)) {
          cursors.current[step.channel] =
            candidates[candidates.length - 1].index + 1;
          throw new Error(`设备返回失败响应：${failureValue}`);
        }
        const matched =
          step.matchMode === "equals"
            ? sources.some((source) => source.trim() === expected.trim()) ||
              combined.trim() === expected.trim()
            : step.matchMode === "regex"
              ? new RegExp(expected).test(combined)
              : combined.includes(expected);
        if (matched) {
          cursors.current[step.channel] =
            candidates[candidates.length - 1].index + 1;
          return combined;
        }
      }
      await sleep(100);
    }
    throw new Error(
      shouldMatch ? `超时：未匹配到“${expectedValue}”` : "等待响应超时",
    );
  };
  const captureResponse = (step: TestStep, response: string) => {
    const name = step.captureName?.trim().toUpperCase().replace(/\W/g, "_"),
      expression = step.captureRegex?.trim();
    if (!name || !expression) return;
    const match = new RegExp(
      resolveVariables(expression, runtimeVariables.current),
    ).exec(response);
    if (!match) throw new Error(`响应通过，但未提取到变量 ${name}`);
    const value = match.groups
        ? Object.values(match.groups)[0]
        : (match[1] ?? match[0]),
      existing = runtimeVariables.current.find((item) => item.name === name);
    runtimeVariables.current = existing
      ? runtimeVariables.current.map((item) =>
          item.name === name ? { ...item, value } : item,
        )
      : [
          ...runtimeVariables.current,
          { id: crypto.randomUUID(), name, value, secret: false },
        ];
    setSuites((previous) =>
      previous.map((suite) =>
        suite.id === selectedSuite.id
          ? { ...suite, variables: runtimeVariables.current }
          : suite,
      ),
    );
    addRunLog("pass", `已提取变量 {{${name}}} = ${value}`);
  };
  const requestManualConfirmation = (message: string) =>
    new Promise<boolean>((resolve) =>
      setManualConfirmation({ message, resolve }),
    );
  const finishManualConfirmation = (approved: boolean) => {
    manualConfirmation?.resolve(approved);
    setManualConfirmation(null);
  };

  const runCase = async () => {
    if (!selectedCase || running) return;
    const testDefinitionSha256 = await createConfigurationFingerprint(selectedCase),
      inputEnvironment = Object.fromEntries((selectedSuite.variables ?? []).filter(variable => !variable.secret).map(variable => [variable.name, variable.value])),
      secretInputCount = (selectedSuite.variables ?? []).filter(variable => variable.secret).length;
    setRunning(true);
    setRunLogs([]);
    runLogsRef.current = [];
    setStatuses({});
    setLastResult(null);
    stopRequested.current = false;
    executingTeardown.current = false;
    incoming.current = [];
    cursors.current = {};
    sessionEvidence.current.clear();
    runtimeVariables.current = (selectedSuite.variables ?? []).map((item) => ({
      ...item,
    }));
    const started = Date.now(),
      startedAt = new Date(started).toISOString(),
      stepRuns: TestStepRun[] = [];
    let passed = 0,
      failed = 0,
      haltMain = false,
      aborted = false;
    addRunLog("info", `开始执行：${selectedCase.name}`);
    const requiredChannels = requiredFlowChannels(selectedCase);
    for (const channel of requiredChannels)
      if (
        (channel === "serial-a" || channel === "serial-b") &&
        !serials.current.has(channel)
      )
        if (serialSelection[channel]) await bindSerial(channel);
        else await connectSerial(channel);
    for (const channel of requiredChannels) {
      if (sessionEvidence.current.has(channel)) continue;
      const runtime = serials.current.get(channel);
      if (runtime)
        sessionEvidence.current.set(channel, {
          channel,
          transport: "serial",
          sessionId: runtime.id,
          endpoint: runtime.path,
          rxBytes: 0,
          txBytes: 0,
          startedAt,
        });
    }
    for (const step of orderedFlowSteps(selectedCase.steps)) {
      const stage = step.stage ?? "test";
      if ((haltMain || stopRequested.current) && stage !== "teardown") {
        aborted ||= stopRequested.current;
        setStatuses((previous) => ({ ...previous, [step.id]: "skipped" }));
        stepRuns.push({
          id: step.id,
          name: step.name,
          type: step.type,
          channel: step.channel,
          status: "skipped",
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: 0,
          retries: 0,
        });
        continue;
      }
      executingTeardown.current = stage === "teardown";
      const executionStep = resolvedFlowStep(selectedCase, step),
        stepStarted = Date.now(),
        stepStartedAt = new Date(stepStarted).toISOString();
      let attempts = 0,
        observedEvidence = "";
      setStatuses((previous) => ({ ...previous, [step.id]: "running" }));
      addRunLog(
        "info",
        `${stageLabels[stage]} · ${typeLabels[step.type]}：${step.name}`,
      );
      try {
        let lastError: unknown;
        const retries = Math.max(0, Math.min(10, step.retryCount || 0));
        for (let attempt = 0; attempt <= retries; attempt += 1) {
          attempts = attempt;
          try {
            if (stopRequested.current && stage !== "teardown")
              throw new Error("执行已停止");
            if (executionStep.type === "command") {
              cursors.current[executionStep.channel] = incoming.current.length;
              await sendData(executionStep);
              const response = await waitForInput(
                executionStep,
                true,
                executionStep.expected || "OK",
                executionStep.failurePattern || "ERROR|FAIL",
              );
              observedEvidence = response;
              captureResponse(executionStep, response);
            } else if (executionStep.type === "send")
              await sendData(executionStep);
            else if (executionStep.type === "delay")
              await sleep(Math.max(0, executionStep.durationMs));
            else if (executionStep.type === "wait-online")
              await ensureChannel(executionStep.channel);
            else if (executionStep.type === "clear-buffer") {
              incoming.current = incoming.current.filter(
                (item) => item.channel !== executionStep.channel,
              );
              cursors.current = {};
            } else if (executionStep.type === "set-variable") {
              const name = (executionStep.captureName || "VARIABLE")
                  .trim()
                  .toUpperCase()
                  .replace(/\W/g, "_"),
                value = resolveVariables(
                  executionStep.data,
                  runtimeVariables.current,
                ),
                existing = runtimeVariables.current.find(
                  (item) => item.name === name,
                );
              runtimeVariables.current = existing
                ? runtimeVariables.current.map((item) =>
                    item.name === name ? { ...item, value } : item,
                  )
                : [
                    ...runtimeVariables.current,
                    { id: crypto.randomUUID(), name, value, secret: false },
                  ];
            } else if (executionStep.type === "manual") {
              if (
                !(await requestManualConfirmation(
                  executionStep.data || executionStep.name,
                ))
              )
                throw new Error("人工确认未通过");
            } else
              observedEvidence = await waitForInput(
                executionStep,
                executionStep.type === "match",
              );
            lastError = undefined;
            break;
          } catch (reason) {
            lastError = reason;
            if (stopRequested.current && stage !== "teardown") break;
            if (attempt < retries)
              addRunLog(
                "info",
                `${step.name} · 第 ${attempt + 1} 次失败，重新执行完整指令事务`,
              );
          }
        }
        if (lastError) throw lastError;
        const finished = Date.now();
        stepRuns.push({
          id: step.id,
          name: step.name,
          type: step.type,
          channel: executionStep.channel,
          status: "passed",
          startedAt: stepStartedAt,
          finishedAt: new Date(finished).toISOString(),
          durationMs: finished - stepStarted,
          retries: attempts,
          evidence:
            executionStep.type === "manual"
              ? {
                  source: "manual-confirmation",
                  observed: "操作人员确认通过",
                }
              : {
                  source: observedEvidence
                    ? "device-response"
                    : "runtime",
                  ...(executionStep.expected
                    ? { expected: executionStep.expected }
                    : {}),
                  ...(observedEvidence
                    ? { observed: observedEvidence }
                    : {}),
                },
        });
        setStatuses((previous) => ({ ...previous, [step.id]: "passed" }));
        addRunLog("pass", `${step.name} · 通过`);
        passed += 1;
      } catch (reason) {
        const message =
            reason instanceof Error ? reason.message : String(reason),
          finished = Date.now();
        stepRuns.push({
          id: step.id,
          name: step.name,
          type: step.type,
          channel: executionStep.channel,
          status: "failed",
          startedAt: stepStartedAt,
          finishedAt: new Date(finished).toISOString(),
          durationMs: finished - stepStarted,
          retries: attempts,
          error: message,
          evidence: {
            source:
              executionStep.type === "manual"
                ? "manual-confirmation"
                : observedEvidence ||
                    incoming.current.some(
                      (item) => item.channel === executionStep.channel,
                    )
                  ? "device-response"
                  : "runtime",
            ...(executionStep.expected || executionStep.type === "match"
              ? {
                  expected:
                    executionStep.expected || executionStep.data || "",
                }
              : {}),
            observed:
              executionStep.type === "manual"
                ? "操作人员确认未通过"
                : incoming.current
                    .filter((item) => item.channel === executionStep.channel)
                    .slice(-20)
                    .map((item) =>
                      executionStep.hex ? item.hex : item.text,
                    )
                    .join(executionStep.hex ? " " : "")
                    .slice(-TEST_RUN_OBSERVED_LIMIT),
            timeoutMs: executionStep.timeoutMs,
          },
        });
        setStatuses((previous) => ({ ...previous, [step.id]: "failed" }));
        addRunLog("fail", `${step.name} · ${message}`);
        failed += 1;
        if (stopRequested.current) {
          aborted = true;
          haltMain = true;
        } else if (step.onFailure !== "continue") haltMain = true;
        else addRunLog("info", `${step.name} · 按配置继续后续步骤`);
      }
      executingTeardown.current = false;
    }
    const communicationEvidence = [...sessionEvidence.current.values()].map(item => ({ ...item })),
      communications = communicationEvidence.map(({ startedAt: _startedAt, ...item }) => item),
      cleanupStarted = Date.now(),
      cleanupFailures = await releaseResources(false, true);
    if (cleanupFailures.length) {
      failed += 1;
      const cleanupFinished = Date.now();
      stepRuns.push({
        id: "__resource-cleanup__",
        name: "资源清理",
        type: "cleanup",
        channel: cleanupFailures.map((item) => item.name).join(","),
        status: "failed",
        startedAt: new Date(cleanupStarted).toISOString(),
        finishedAt: new Date(cleanupFinished).toISOString(),
        durationMs: cleanupFinished - cleanupStarted,
        retries: 0,
        error: cleanupFailures
          .map((item) => `${item.name}: ${item.error}`)
          .join("; "),
      });
    }
    const finished = Date.now(),
      duration = finished - started,
      status =
        aborted || stopRequested.current
          ? "aborted"
          : failed
            ? "failed"
            : "passed";
    setLastResult({ passed, failed, duration, caseName: selectedCase.name });
    addRunLog(
      status === "passed" ? "pass" : status === "failed" ? "fail" : "info",
      status === "aborted"
        ? `执行已停止 · ${duration} ms`
        : failed
          ? `执行失败 · ${duration} ms`
          : `全部通过 · ${duration} ms`,
    );
    const selectedFirmware = firmwareChoices.find(
        (item) => item.id === selectedFirmwareId && item.sha256,
      ),
      runId = crypto.randomUUID(),
      finishedAt = new Date(finished).toISOString(),
      communicationSessions = createCommunicationSessionRecords(communicationEvidence, { runId, finishedAt, status, firmwareId: selectedFirmware?.firmwareId }),
      secretValues = runtimeVariables.current
        .filter((variable) => variable.secret)
        .map((variable) => variable.value),
      record = createTestRunEvidence(
        {
          schemaVersion: 3,
          id: runId,
          suiteId: selectedSuite.id,
          suiteName: selectedSuite.name,
          caseId: selectedCase.id,
          caseName: selectedCase.name,
          status,
          startedAt,
          finishedAt,
          durationMs: duration,
          passed,
          failed,
          agentVersion,
          ...(selectedFirmware
            ? {
                ...(selectedFirmware.firmwareId ? { firmwareId: selectedFirmware.firmwareId } : {}),
                firmware: {
                  buildId: selectedFirmware.buildId,
                  artifactName: selectedFirmware.fileName,
                  artifactType: selectedFirmware.artifactType,
                  size: selectedFirmware.size,
                  modifiedAt: selectedFirmware.modifiedAt,
                  sha256: selectedFirmware.sha256!,
                  analyzedAt: selectedFirmware.analyzedAt,
                },
              }
            : {}),
          communications,
          communicationSessionIds: communicationSessions.map(session => session.id),
          ...(baselineRunId ? { baselineRunId } : {}),
          testDefinitionSha256,
          inputEnvironment,
          secretInputCount,
          environment: Object.fromEntries(
            runtimeVariables.current
              .filter((variable) => !variable.secret)
              .map((variable) => [variable.name, variable.value]),
          ),
          steps: stepRuns,
          logs: runLogsRef.current.map(({ time, level, text }) => ({
            time,
            level,
            text,
          })),
        },
        secretValues,
      );
    try {
      const storedRecord = await saveTestRunWithCommunicationSessions(record, communicationSessions);
      setRunHistory((previous) => [storedRecord, ...previous]);
    } finally {
      setRunning(false);
    }
  };
  const stopRun = () => {
    stopRequested.current = true;
    if (manualConfirmation) finishManualConfirmation(false);
    addRunLog("info", "正在停止，当前步骤结束后保存记录");
  };

  const updateStep = (patch: Partial<TestStep>) => {
    if (!selectedCase || !selectedStep) return;
    setSuites((previous) =>
      previous.map((suite) =>
        suite.id !== selectedSuite.id
          ? suite
          : {
              ...suite,
              cases: suite.cases.map((item) => {
                if (item.id !== selectedCase.id) return item;
                if (patch.channel && item.sharedChannel !== false)
                  return {
                    ...item,
                    channel: patch.channel,
                    steps: item.steps.map((step) =>
                      stepUsesChannel(step.type)
                        ? { ...step, channel: patch.channel! }
                        : step,
                    ),
                  };
                return {
                  ...item,
                  steps: item.steps.map((step) =>
                    step.id === selectedStep.id ? { ...step, ...patch } : step,
                  ),
                };
              }),
            },
      ),
    );
  };
  const setStepType = (type: StepType) => {
    if (!selectedStep) return;
    const defaults = createStep(type);
    updateStep({
      type,
      name: typeLabels[type],
      data: defaults.data,
      expected: defaults.expected,
      captureName: defaults.captureName,
      timeoutMs: defaults.timeoutMs,
      durationMs: defaults.durationMs,
      retryCount: defaults.retryCount,
    });
  };
  const addStep = (type: StepType) => {
    if (!selectedCase) return;
    const step = {
      ...createStep(type),
      channel:
        selectedCase.sharedChannel !== false
          ? sharedFlowChannel(selectedCase)
          : "serial-a",
    };
    setSuites((previous) =>
      previous.map((suite) =>
        suite.id !== selectedSuite.id
          ? suite
          : {
              ...suite,
              cases: suite.cases.map((item) =>
                item.id === selectedCase.id
                  ? { ...item, steps: [...item.steps, step] }
                  : item,
              ),
            },
      ),
    );
    setSelectedStepId(step.id);
  };
  const deleteStep = (id: string) => {
    if (!selectedCase) return;
    const result = removeFlowStep(selectedCase.steps, id, selectedStepId);
    setSuites((previous) =>
      previous.map((suite) =>
        suite.id !== selectedSuite.id
          ? suite
          : {
              ...suite,
              cases: suite.cases.map((item) =>
                item.id === selectedCase.id
                  ? { ...item, steps: result.steps }
                  : item,
              ),
            },
      ),
    );
    setSelectedStepId(result.selectedId);
  };
  const moveStep = (id: string, offset: number) => {
    if (!selectedCase) return;
    const steps = reorderFlowStep(selectedCase.steps, id, offset);
    if (steps === selectedCase.steps) return;
    setSuites((previous) =>
      previous.map((suite) =>
        suite.id !== selectedSuite.id
          ? suite
          : {
              ...suite,
              cases: suite.cases.map((item) =>
                item.id === selectedCase.id ? { ...item, steps } : item,
              ),
            },
      ),
    );
  };
  const addCase = () => {
    const item: TestCase = {
      id: crypto.randomUUID(),
      name: `测试流程 ${selectedSuite.cases.length + 1}`,
      sharedChannel: true,
      channel: "serial-a",
      lineEnding: "none",
      steps: [createStep()],
    };
    setSuites((previous) =>
      previous.map((suite) =>
        suite.id === selectedSuite.id
          ? { ...suite, cases: [...suite.cases, item] }
          : suite,
      ),
    );
    setSelectedCaseId(item.id);
    setSelectedStepId(item.steps[0].id);
  };
  const selectSuite = (id: string) => {
    const suite = suites.find((item) => item.id === id);
    if (!suite) return;
    setSelectedSuiteId(id);
    setSelectedCaseId(suite.cases[0]?.id ?? "");
    setSelectedStepId(suite.cases[0]?.steps[0]?.id ?? "");
    setStatuses({});
    setLastResult(null);
  };
  const addSuite = () => {
    const suite: TestSuite = {
      id: crypto.randomUUID(),
      name: `测试套件 ${suites.length + 1}`,
      variables: [],
      cases: [
        {
          id: crypto.randomUUID(),
          name: "启动与响应",
          sharedChannel: true,
          channel: "serial-a",
          lineEnding: "none",
          steps: [createStep("command")],
        },
      ],
    };
    setSuites((previous) => [...previous, suite]);
    selectSuite(suite.id);
    setSelectedSuiteId(suite.id);
    setSelectedCaseId(suite.cases[0].id);
    setSelectedStepId(suite.cases[0].steps[0].id);
  };
  const duplicateSuite = () => {
    const suite: TestSuite = {
      ...selectedSuite,
      id: crypto.randomUUID(),
      name: `${selectedSuite.name} 副本`,
      variables: (selectedSuite.variables ?? []).map((item) => ({
        ...item,
        id: crypto.randomUUID(),
      })),
      cases: selectedSuite.cases.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
        steps: item.steps.map((step) => ({ ...step, id: crypto.randomUUID() })),
      })),
    };
    setSuites((previous) => [...previous, suite]);
    setSelectedSuiteId(suite.id);
    setSelectedCaseId(suite.cases[0]?.id ?? "");
    setSelectedStepId(suite.cases[0]?.steps[0]?.id ?? "");
  };
  const deleteSuite = () => {
    if (
      suites.length <= 1 ||
      !window.confirm(`删除测试套件“${selectedSuite.name}”？`)
    )
      return;
    const remaining = suites.filter((item) => item.id !== selectedSuite.id),
      next = remaining[0];
    setSuites(remaining);
    setSelectedSuiteId(next.id);
    setSelectedCaseId(next.cases[0]?.id ?? "");
    setSelectedStepId(next.cases[0]?.steps[0]?.id ?? "");
  };
  const addAtNetworkCase = () => {
    const item = createAtNetworkCase();
    setSuites((previous) =>
      previous.map((suite) => {
        if (suite.id !== selectedSuite.id) return suite;
        const variables = [...(suite.variables ?? [])];
        if (!variables.some((variable) => variable.name === "SSID"))
          variables.push({
            id: crypto.randomUUID(),
            name: "SSID",
            value: "",
            secret: false,
          });
        if (!variables.some((variable) => variable.name === "PASSWORD"))
          variables.push({
            id: crypto.randomUUID(),
            name: "PASSWORD",
            value: "",
            secret: true,
          });
        return { ...suite, variables, cases: [...suite.cases, item] };
      }),
    );
    setSelectedCaseId(item.id);
    setSelectedStepId(item.steps[0].id);
    setStatuses({});
  };
  const deleteCase = (id: string) => {
    const target = selectedSuite.cases.find((item) => item.id === id);
    if (!target || !window.confirm(`删除测试流程“${target.name}”？`)) return;
    const remaining = selectedSuite.cases.filter((item) => item.id !== id),
      next = selectedCaseId === id ? remaining[0] : selectedCase;
    setSuites((previous) =>
      previous.map((suite) =>
        suite.id === selectedSuite.id ? { ...suite, cases: remaining } : suite,
      ),
    );
    if (selectedCaseId === id) {
      setSelectedCaseId(next?.id ?? "");
      setSelectedStepId(next?.steps[0]?.id ?? "");
    }
    setStatuses({});
    setLastResult(null);
  };
  const updateVariables = (variables: FlowVariable[]) =>
    setSuites((previous) =>
      previous.map((suite) =>
        suite.id === selectedSuite.id ? { ...suite, variables } : suite,
      ),
    );
  const setFlowChannel = (channel: Channel) => {
    if (!selectedCase) return;
    setSuites((previous) =>
      previous.map((suite) =>
        suite.id !== selectedSuite.id
          ? suite
          : {
              ...suite,
              cases: suite.cases.map((item) =>
                item.id === selectedCase.id
                  ? {
                      ...item,
                      channel,
                      steps: item.steps.map((step) =>
                        stepUsesChannel(step.type)
                          ? { ...step, channel }
                          : step,
                      ),
                    }
                  : item,
              ),
            },
      ),
    );
  };
  const setSharedChannel = (sharedChannel: boolean) => {
    if (!selectedCase) return;
    setSuites((previous) =>
      previous.map((suite) =>
        suite.id !== selectedSuite.id
          ? suite
          : {
              ...suite,
              cases: suite.cases.map((item) =>
                item.id === selectedCase.id
                  ? applySharedFlowChannel(item, sharedChannel)
                  : item,
              ),
            },
      ),
    );
  };
  const setLineEnding = (lineEnding: LineEnding) => {
    if (!selectedCase) return;
    setSuites((previous) =>
      previous.map((suite) =>
        suite.id !== selectedSuite.id
          ? suite
          : {
              ...suite,
              cases: suite.cases.map((item) =>
                item.id === selectedCase.id ? { ...item, lineEnding } : item,
              ),
            },
      ),
    );
  };
  const addVariable = () =>
    updateVariables([
      ...(selectedSuite.variables ?? []),
      {
        id: crypto.randomUUID(),
        name: `VAR_${(selectedSuite.variables?.length ?? 0) + 1}`,
        value: "",
        secret: false,
      },
    ]);
  const exportSuite = () => {
    const safeSuite = {
        ...selectedSuite,
        variables: selectedSuite.variables?.map((variable) =>
          variable.secret ? { ...variable, value: "" } : variable,
        ),
      },
      payload = {
        schema: "embedkit.test-suite",
        version: 1,
        exportedAt: new Date().toISOString(),
        suite: safeSuite,
      };
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    );
    link.download = `embedkit-suite-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const importSuite = async (file: File) => {
    try {
      const value = JSON.parse(await file.text()) as {
          schema?: string;
          version?: number;
          suite?: Partial<TestSuite>;
          name?: string;
          cases?: TestCase[];
        },
        parsed = value.schema ? value.suite : (value as Partial<TestSuite>);
      if (
        value.schema &&
        (value.schema !== "embedkit.test-suite" || value.version !== 1)
      )
        throw new Error("不支持的测试套件版本");
      if (!parsed?.name || !Array.isArray(parsed.cases))
        throw new Error("文件不是有效的测试套件");
      const importedCases = parsed.cases.map((item) => {
          const channel = sharedFlowChannel(item);
          return {
            ...item,
            id: crypto.randomUUID(),
            sharedChannel: item.sharedChannel ?? true,
            channel,
            lineEnding: isLineEnding(item.lineEnding) ? item.lineEnding : "none",
            steps: item.steps.map((step) => ({
              ...createStep(step.type),
              ...step,
              lineEnding: isLineEnding(step.lineEnding)
                ? step.lineEnding
                : undefined,
              stage: step.stage ?? "test",
              channel: item.sharedChannel === false ? step.channel : channel,
              id: crypto.randomUUID(),
            })),
          };
        }),
        imported: TestSuite = {
          id: crypto.randomUUID(),
          name: `${parsed.name}（导入）`,
          variables: Array.isArray(parsed.variables)
            ? parsed.variables.map((variable) => ({
                ...variable,
                id: crypto.randomUUID(),
              }))
            : [],
          cases: importedCases,
        };
      setSuites((previous) => [...previous, imported]);
      setSelectedSuiteId(imported.id);
      setSelectedCaseId(imported.cases[0]?.id ?? "");
      setSelectedStepId(imported.cases[0]?.steps[0]?.id ?? "");
      addRunLog("pass", `已导入测试套件：${imported.name}`);
    } catch (reason) {
      addRunLog(
        "fail",
        `导入失败：${reason instanceof Error ? reason.message : String(reason)}`,
      );
    }
  };
  const downloadText = (name: string, content: string, type: string) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type }));
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const escapeMarkup = (value: unknown) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character] ?? character,
    );
  const exportReport = (run = runHistory[0]) => {
    if (!run) return;
    const rows = run.steps
        .map(
          (step) =>
            `<tr><td>${escapeMarkup(step.name)}</td><td>${escapeMarkup(typeLabels[step.type as StepType] ?? step.type)}</td><td>${escapeMarkup(channelLabels[step.channel as Channel] ?? step.channel)}</td><td>${escapeMarkup(step.status)}</td><td>${step.durationMs} ms</td><td>${escapeMarkup(step.evidence?.source ?? "无")}</td><td>${escapeMarkup(step.evidence?.observed ?? step.error)}</td></tr>`,
        )
        .join(""),
      environment = Object.entries(run.environment)
        .map(
          ([name, value]) =>
            `<li><b>${escapeMarkup(name)}</b>：${escapeMarkup(value)}</li>`,
        )
        .join(""),
      logs = run.logs
        .map(
          (log) =>
            `${escapeMarkup(log.time)} [${escapeMarkup(log.level)}] ${escapeMarkup(log.text)}`,
        )
        .join("\n"),
      firmware = run.firmware
        ? `${escapeMarkup(run.firmware.artifactName)} · SHA-256 ${escapeMarkup(run.firmware.sha256)}`
        : "未关联已计算的固件指纹",
      communications = (run.communications ?? [])
        .map(
          (item, index) =>
            `<li>${escapeMarkup(item.channel)} · ${escapeMarkup(item.transport)} · ${escapeMarkup(item.endpoint)} · RX ${item.rxBytes} / TX ${item.txBytes} 字节 · 归档 ${escapeMarkup(run.communicationSessionIds?.[index] ?? '未归档')} · 源会话 ${escapeMarkup(item.sessionId)}</li>`,
        )
        .join(""),
      html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>EmbedKit 测试报告</title><style>body{font:14px sans-serif;margin:32px;color:#222}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}.passed{color:#16803c}.failed,.error{color:#c62828}pre{white-space:pre-wrap;background:#f5f5f5;padding:12px}</style></head><body><h1>EmbedKit 通信测试报告</h1><p>套件：${escapeMarkup(run.suiteName)} · 流程：${escapeMarkup(run.caseName)}</p><p>固件：${firmware}</p><p>Agent：${escapeMarkup(run.agentVersion)} · 开始：${escapeMarkup(new Date(run.startedAt).toLocaleString())} · 耗时：${run.durationMs} ms</p><p class="${run.status}">结果：${escapeMarkup(run.status)} · 通过 ${run.passed} · 失败 ${run.failed}</p><h2>证据说明</h2><p>通信响应来自实际会话；人工确认仅代表操作人员确认；固件与端点快照只用于追溯，不单独证明测试通过。</p><h2>通信会话</h2><ul>${communications || "<li>本次流程未建立通信会话</li>"}</ul><h2>运行环境</h2><ul>${environment || "<li>无公开变量</li>"}</ul><h2>步骤</h2><table><tr><th>步骤</th><th>类型</th><th>通道</th><th>结果</th><th>耗时</th><th>证据类型</th><th>观测/失败</th></tr>${rows}</table><h2>执行日志</h2><pre>${logs}</pre></body></html>`;
    downloadText(
      `embedkit-report-${run.id}.html`,
      html,
      "text/html;charset=utf-8",
    );
  };
  const exportRunJson = (run = runHistory[0]) => {
    if (run)
      downloadText(
        `embedkit-run-${run.id}.json`,
        JSON.stringify(createTestRunJsonReport(run), null, 2),
        "application/json;charset=utf-8",
      );
  };
  const exportRunJunit = (run = runHistory[0]) => {
    if (!run) return;
    const cases = run.steps
      .map(
        (step) =>
          `<testcase name="${escapeMarkup(step.name)}" classname="${escapeMarkup(run.suiteName)}" time="${(step.durationMs / 1000).toFixed(3)}">${step.status === "failed" ? `<failure message="${escapeMarkup(step.error || "failed")}"/>` : step.status === "skipped" ? "<skipped/>" : ""}</testcase>`,
      )
      .join("");
    downloadText(
      `embedkit-run-${run.id}.xml`,
      `<?xml version="1.0" encoding="UTF-8"?><testsuite name="${escapeMarkup(run.caseName)}" tests="${run.steps.length}" failures="${run.failed}" skipped="${run.steps.filter((step) => step.status === "skipped").length}" time="${(run.durationMs / 1000).toFixed(3)}">${cases}</testsuite>`,
      "application/xml;charset=utf-8",
    );
  };
  const exportRunCsv = (run = runHistory[0]) => {
    if (!run) return;
    const quote = (value: unknown) =>
        `"${String(value ?? "").replace(/"/g, '""')}"`,
      rows = [
        ["步骤", "类型", "通道", "状态", "耗时(ms)", "重试", "失败原因"],
        ...run.steps.map((step) => [
          step.name,
          step.type,
          step.channel,
          step.status,
          step.durationMs,
          step.retries,
          step.error ?? "",
        ]),
      ];
    downloadText(
      `embedkit-run-${run.id}.csv`,
      `\uFEFF${rows.map((row) => row.map(quote).join(",")).join("\r\n")}`,
      "text/csv;charset=utf-8",
    );
  };
  const removeRun = async (id: string) => {
    await deleteTestRun(id);
    setRunHistory((previous) => previous.filter((item) => item.id !== id));
  };

  const passCount = useMemo(
    () => Object.values(statuses).filter((value) => value === "passed").length,
    [statuses],
  );
  return (
    <div className="automation-page serial-page h-full overflow-hidden p-3 lg:p-4">
      <div className="mx-auto flex h-full min-h-0 max-w-[1700px] flex-col">
        <header className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
              <FlaskConical size={18} />
            </span>
            <div>
              <h1 className="text-base font-semibold text-gray-100">
                自动化集成测试
              </h1>
              <p className="text-[11px] text-gray-600">
                流程编排 · 多通道执行 · 自动断言 · HTML 报告
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[#30363d] bg-[#161b22] px-3 py-1 text-[11px] text-gray-500">
              {passCount}/{selectedCase?.steps.length ?? 0} 已通过
            </span>
            {running ? (
              <button
                onClick={stopRun}
                className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-300"
              >
                <CircleStop size={13} />
                停止
              </button>
            ) : (
              <button
                onClick={() => void runCase()}
                disabled={!selectedCase?.steps.length}
                className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              >
                <Play size={13} />
                运行流程
              </button>
            )}
          </div>
        </header>
        <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[230px_minmax(430px,1fr)_350px]">
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#30363d] bg-[#0d1117]">
            <div className="border-b border-[#30363d] bg-[#111820] p-2">
              <div className="mb-2 flex items-center gap-1">
                <select
                  aria-label="测试套件"
                  value={selectedSuiteId}
                  onChange={(event) => selectSuite(event.target.value)}
                  disabled={running}
                  className="min-w-0 flex-1 rounded border border-[#30363d] bg-[#161b22] px-2 py-1.5 text-xs font-semibold"
                >
                  {suites.map((suite) => (
                    <option key={suite.id} value={suite.id}>
                      {suite.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={addSuite}
                  disabled={running}
                  className="rounded border border-[#30363d] p-1.5 text-cyan-400"
                  title="新建套件"
                >
                  <Plus size={11} />
                </button>
                <button
                  onClick={duplicateSuite}
                  disabled={running}
                  className="rounded border border-[#30363d] p-1.5 text-gray-400"
                  title="复制套件"
                >
                  <Copy size={11} />
                </button>
                <button
                  onClick={deleteSuite}
                  disabled={running || suites.length <= 1}
                  className="rounded border border-red-500/20 p-1.5 text-red-400 disabled:opacity-30"
                  title="删除套件"
                >
                  <Trash2 size={11} />
                </button>
              </div>
              <input
                value={selectedSuite?.name ?? ""}
                onChange={(event) =>
                  setSuites((previous) =>
                    previous.map((item) =>
                      item.id === selectedSuiteId
                        ? { ...item, name: event.target.value }
                        : item,
                    ),
                  )
                }
                className="w-full rounded-md border border-[#30363d] bg-[#161b22] px-2.5 py-2 text-xs font-medium text-gray-200 outline-none focus:border-cyan-500"
              />
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2 scrollbar-thin">
              {selectedSuite?.cases.map((item) => (
                <div
                  key={item.id}
                  className={`flex overflow-hidden rounded-lg border ${selectedCase?.id === item.id ? "border-cyan-500/40 bg-cyan-500/10" : "border-[#30363d]/60 hover:border-[#30363d] hover:bg-white/[0.02]"}`}
                >
                  <button
                    onClick={() => {
                      setSelectedCaseId(item.id);
                      setSelectedStepId(item.steps[0]?.id ?? "");
                      setStatuses({});
                    }}
                    className="min-w-0 flex-1 px-3 py-2.5 text-left"
                  >
                    <b className="block truncate text-xs text-gray-200">
                      {item.name}
                    </b>
                    <small className="mt-1 block text-[10px] text-gray-600">
                      {item.steps.length} 个步骤 · 按顺序执行
                    </small>
                  </button>
                  <button
                    onClick={() => deleteCase(item.id)}
                    disabled={running}
                    className="flex shrink-0 items-center gap-1 border-l border-red-500/20 bg-red-500/5 px-2.5 text-[10px] text-red-400 hover:bg-red-500/15 hover:text-red-300 disabled:opacity-30"
                    title="删除测试流程"
                  >
                    <Trash2 size={12} />
                    删除
                  </button>
                </div>
              ))}
            </div>
            <div className="grid gap-1.5 p-2">
              <button
                onClick={addCase}
                disabled={running}
                className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-[#30363d] py-2 text-xs text-gray-500 hover:border-cyan-500/40 hover:text-cyan-300 disabled:opacity-40"
              >
                <Plus size={12} />
                新建空白流程
              </button>
              <button
                onClick={addAtNetworkCase}
                disabled={running}
                className="flex items-center justify-center gap-1 rounded-lg border border-cyan-500/20 bg-cyan-500/5 py-2 text-xs text-cyan-400 hover:border-cyan-500/40 disabled:opacity-40"
              >
                <Plus size={12} />
                AT 模组联网模板
              </button>
            </div>
          </aside>
          <main className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#30363d] bg-[#0d1117]">
            <div className="flex items-center gap-2 border-b border-[#30363d] bg-[#111820] px-3 py-2">
              <input
                value={selectedCase?.name ?? ""}
                onChange={(event) => {
                  if (!selectedCase) return;
                  setSuites((previous) =>
                    previous.map((suite) =>
                      suite.id !== selectedSuite.id
                        ? suite
                        : {
                            ...suite,
                            cases: suite.cases.map((item) =>
                              item.id === selectedCase.id
                                ? { ...item, name: event.target.value }
                                : item,
                            ),
                          },
                    ),
                  );
                }}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-gray-200 outline-none"
              />
              <Save size={13} className="text-gray-600" />
              <span className="text-[10px] text-gray-600">自动保存</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2 scrollbar-thin">
              {selectedCase?.steps.map((step, index) => {
                const status = statuses[step.id] ?? "idle";
                return (
                  <div
                    key={step.id}
                    onClick={() => setSelectedStepId(step.id)}
                    className={`mb-1.5 flex cursor-pointer items-center gap-2 rounded-lg border p-2 ${selectedStep?.id === step.id ? "border-cyan-500/50 bg-cyan-500/5" : "border-[#30363d] bg-[#111820]"}`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0d1117] text-[10px] text-gray-500">
                      {index + 1}
                    </span>
                    <span className="rounded bg-[#0d1117] px-1.5 py-1 text-[9px] text-gray-600">
                      {stageLabels[step.stage ?? "test"]}
                    </span>
                    <span
                      className={`rounded px-2 py-1 text-[10px] font-medium ${typeColors[step.type]}`}
                    >
                      {typeLabels[step.type]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-gray-300">
                      {step.name}
                    </span>
                    {stepUsesChannel(step.type) && (
                      <span className="rounded bg-[#0d1117] px-2 py-1 text-[10px] text-gray-600">
                        {channelLabels[step.channel]}
                      </span>
                    )}
                    {status === "running" && (
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                    )}
                    {status === "passed" && (
                      <Check size={14} className="text-green-400" />
                    )}
                    {status === "failed" && (
                      <XCircle size={14} className="text-red-400" />
                    )}
                    {status === "skipped" && (
                      <span className="text-[9px] text-gray-600">跳过</span>
                    )}
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        moveStep(step.id, -1);
                      }}
                      disabled={index === 0 || running}
                      className="text-gray-600 disabled:opacity-20"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        moveStep(step.id, 1);
                      }}
                      disabled={
                        index === selectedCase.steps.length - 1 || running
                      }
                      className="text-gray-600 disabled:opacity-20"
                    >
                      <ChevronDown size={13} />
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteStep(step.id);
                      }}
                      disabled={running}
                      className="text-gray-600 hover:text-red-400 disabled:opacity-20"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1.5 border-t border-[#30363d] bg-[#0b1016] p-2">
              {(
                [
                  "command",
                  "send",
                  "wait",
                  "match",
                  "delay",
                  "wait-online",
                  "clear-buffer",
                  "set-variable",
                  "manual",
                ] as StepType[]
              ).map((type) => (
                <button
                  key={type}
                  onClick={() => addStep(type)}
                  disabled={running}
                  className="flex items-center gap-1 rounded-md border border-[#30363d] bg-[#161b22] px-2 py-1.5 text-[10px] text-gray-400 hover:border-cyan-500/40 hover:text-cyan-300 disabled:opacity-40"
                >
                  <Plus size={10} />
                  {typeLabels[type]}
                </button>
              ))}
            </div>
          </main>
          <aside className="flex min-h-0 flex-col gap-2 overflow-hidden">
            <section className="shrink-0 rounded-xl border border-[#30363d] bg-[#0d1117]">
              <div className="border-b border-[#30363d] bg-[#111820] px-3 py-2 text-xs font-semibold text-gray-300">
                步骤设置
              </div>
              {selectedStep ? (
                <div className="grid gap-2 p-3">
                  <details className="rounded-lg border border-[#30363d] bg-[#111820] px-2 py-1.5">
                    <summary className="cursor-pointer text-[10px] text-gray-400">
                      基础属性 · {stageLabels[selectedStep.stage ?? "test"]} / {typeLabels[selectedStep.type]}{stepUsesChannel(selectedStep.type) ? ` / ${channelLabels[selectedStep.channel]}` : ""}
                    </summary>
                    <div className="mt-2 grid gap-2 border-t border-[#30363d] pt-2">
                      <label className="text-[11px] text-gray-500">
                        步骤名称
                        <input
                          value={selectedStep.name}
                          onChange={(event) =>
                            updateStep({ name: event.target.value })
                          }
                          disabled={running}
                          className="field"
                        />
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <label className="text-[11px] text-gray-500">阶段<select value={selectedStep.stage ?? "test"} onChange={(event) => updateStep({ stage: event.target.value as StepStage })} disabled={running} className="field">{Object.entries(stageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                        <label className="text-[11px] text-gray-500">类型<select value={selectedStep.type} onChange={(event) => setStepType(event.target.value as StepType)} disabled={running} className="field">{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                        {stepUsesChannel(selectedStep.type) && <label className="text-[11px] text-gray-500">通道<select value={selectedStep.channel} onChange={(event) => updateStep({ channel: event.target.value as Channel })} disabled={running} className="field">{Object.entries(channelLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
                      </div>
                    </div>
                  </details>
                  {(selectedStep.type === "send" ||
                    selectedStep.type === "match") && (
                    <label className="text-[11px] text-gray-500">
                      {selectedStep.type === "send" ? "发送内容" : "期望内容"}
                      <textarea
                        value={selectedStep.data}
                        onChange={(event) =>
                          updateStep({ data: event.target.value })
                        }
                        disabled={running}
                        rows={2}
                        className="mt-1 block w-full resize-none rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-2 font-mono text-xs text-gray-200 outline-none focus:border-cyan-500"
                      />
                    </label>
                  )}
                  {selectedStep.type === "send" && (
                    <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                      <label className="text-[11px] text-gray-500">
                        步骤发送行尾
                        <select aria-label="步骤发送行尾" value={selectedStep.lineEnding ?? "inherit"} onChange={(event) => updateStep({ lineEnding: event.target.value === "inherit" ? undefined : (event.target.value as LineEnding) })} disabled={running || selectedStep.hex} className="field">
                          <option value="inherit">继承用例（{lineEndingLabels[isLineEnding(selectedCase.lineEnding) ? selectedCase.lineEnding : "none"]}）</option>
                          {Object.entries(lineEndingLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                      </label>
                      <label className="flex h-[34px] items-center gap-1 text-xs text-gray-400"><input type="checkbox" checked={selectedStep.hex} onChange={(event) => updateStep({ hex: event.target.checked })} />HEX 数据</label>
                    </div>
                  )}
                  {selectedStep.type === "set-variable" && (
                    <div className="grid grid-cols-[110px_1fr] gap-2">
                      <label className="text-[11px] text-gray-500">变量名<input value={selectedStep.captureName ?? ""} onChange={(event) => updateStep({ captureName: event.target.value.toUpperCase().replace(/\W/g, "_") })} placeholder="VARIABLE" className="field" /></label>
                      <label className="text-[11px] text-gray-500">变量值<input value={selectedStep.data} onChange={(event) => updateStep({ data: event.target.value })} placeholder="支持 {{变量名}}" className="field" /></label>
                    </div>
                  )}
                  {selectedStep.type === "manual" && (
                    <label className="text-[11px] text-gray-500">人工确认提示<input value={selectedStep.data} onChange={(event) => updateStep({ data: event.target.value })} className="field" /></label>
                  )}
                  {selectedStep.type === "match" && (
                    <label className="text-[11px] text-gray-500">
                      匹配方式
                      <select
                        value={selectedStep.matchMode}
                        onChange={(event) =>
                          updateStep({
                            matchMode: event.target
                              .value as TestStep["matchMode"],
                          })
                        }
                        className="field"
                      >
                        <option value="contains">包含</option>
                        <option value="equals">完全相等</option>
                        <option value="regex">正则表达式</option>
                      </select>
                    </label>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {selectedStep.type === "delay" ? (
                      <label className="text-[11px] text-gray-500">
                        延时 ms
                        <input
                          type="number"
                          value={selectedStep.durationMs}
                          onChange={(event) =>
                            updateStep({
                              durationMs: Number(event.target.value),
                            })
                          }
                          className="field"
                        />
                      </label>
                    ) : selectedStep.type !== "send" ? (
                      <label className="text-[11px] text-gray-500">
                        超时 ms
                        <input
                          type="number"
                          value={selectedStep.timeoutMs}
                          onChange={(event) =>
                            updateStep({
                              timeoutMs: Number(event.target.value),
                            })
                          }
                          className="field"
                        />
                      </label>
                    ) : null}
                    {selectedStep.type === "match" && (
                      <label className="mt-5 flex items-center gap-1 text-xs text-gray-400">
                        <input
                          type="checkbox"
                          checked={selectedStep.hex}
                          onChange={(event) =>
                            updateStep({ hex: event.target.checked })
                          }
                        />
                        HEX 数据
                      </label>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 text-xs text-gray-600">
                  选择一个步骤进行设置
                </div>
              )}
            </section>
            <details className="shrink-0 rounded-xl border border-[#30363d] bg-[#0d1117]">
              <summary className="cursor-pointer bg-[#111820] px-3 py-2 text-[10px] text-gray-400">
                流程变量 · {(selectedSuite.variables ?? []).length} 项
              </summary>
              <div className="flex justify-end border-t border-[#30363d] px-2 pt-2">
                <button
                  onClick={addVariable}
                  disabled={running}
                  className="flex items-center gap-1 text-[10px] text-cyan-400 disabled:opacity-30"
                >
                  <Plus size={11} />
                  变量
                </button>
              </div>
              <div className="max-h-32 space-y-1 overflow-y-auto p-2 scrollbar-thin">
                {(selectedSuite.variables ?? []).length ? (
                  (selectedSuite.variables ?? []).map((variable) => (
                    <div
                      key={variable.id}
                      className="grid grid-cols-[82px_1fr_auto_auto] gap-1"
                    >
                      <input
                        aria-label="变量名称"
                        value={variable.name}
                        disabled={running}
                        onChange={(event) =>
                          updateVariables(
                            (selectedSuite.variables ?? []).map((item) =>
                              item.id === variable.id
                                ? {
                                    ...item,
                                    name: event.target.value
                                      .toUpperCase()
                                      .replace(/\W/g, "_"),
                                  }
                                : item,
                            ),
                          )
                        }
                        className="min-w-0 rounded border border-[#30363d] bg-[#161b22] px-2 py-1 text-[10px] text-cyan-300 outline-none"
                      />
                      <input
                        aria-label={`${variable.name} 的值`}
                        type={variable.secret ? "password" : "text"}
                        value={variable.value}
                        disabled={running}
                        onChange={(event) =>
                          updateVariables(
                            (selectedSuite.variables ?? []).map((item) =>
                              item.id === variable.id
                                ? { ...item, value: event.target.value }
                                : item,
                            ),
                          )
                        }
                        placeholder={`{{${variable.name}}}`}
                        className="min-w-0 rounded border border-[#30363d] bg-[#161b22] px-2 py-1 text-[10px] outline-none"
                      />
                      <label className="flex items-center gap-1 px-1 text-[9px] text-gray-500">
                        <input
                          type="checkbox"
                          checked={variable.secret}
                          disabled={running}
                          onChange={(event) =>
                            updateVariables(
                              (selectedSuite.variables ?? []).map((item) =>
                                item.id === variable.id
                                  ? { ...item, secret: event.target.checked }
                                  : item,
                              ),
                            )
                          }
                        />
                        密码
                      </label>
                      <button
                        onClick={() =>
                          updateVariables(
                            (selectedSuite.variables ?? []).filter(
                              (item) => item.id !== variable.id,
                            ),
                          )
                        }
                        disabled={running}
                        className="px-1 text-red-400 disabled:opacity-30"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="px-1 text-[10px] text-gray-600">
                    指令中可使用 {"{{变量名}}"}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5 border-t border-[#30363d] p-2">
                <label className="flex cursor-pointer items-center justify-center gap-1 rounded border border-[#30363d] py-1 text-[10px] text-gray-500 hover:text-cyan-300">
                  <FileUp size={11} />
                  导入流程
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    disabled={running}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void importSuite(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <button
                  onClick={exportSuite}
                  disabled={running}
                  className="flex items-center justify-center gap-1 rounded border border-[#30363d] py-1 text-[10px] text-gray-500 hover:text-cyan-300 disabled:opacity-40"
                >
                  <Download size={11} />
                  导出流程
                </button>
              </div>
            </details>
            {selectedCase && (
              <details className="shrink-0 rounded-xl border border-[#30363d] bg-[#0d1117] px-3 py-2">
                <summary className="cursor-pointer text-[10px] text-gray-400">
                  流程默认值 · {channelLabels[sharedFlowChannel(selectedCase)]} / {lineEndingLabels[isLineEnding(selectedCase.lineEnding) ? selectedCase.lineEnding : "none"]}
                </summary>
                <div className="mt-2 grid grid-cols-[1fr_90px] items-end gap-2 border-t border-[#30363d] pt-2">
                  <label className="min-w-0 text-[11px] text-gray-500">
                    流程统一通道
                    <select
                      value={
                        selectedCase.channel ??
                        selectedCase.steps.find((step) => step.type !== "delay")
                          ?.channel ??
                        "serial-a"
                      }
                      onChange={(event) =>
                        setFlowChannel(event.target.value as Channel)
                      }
                      disabled={running || selectedCase.sharedChannel === false}
                      className="field"
                    >
                      {Object.entries(channelLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[11px] text-gray-500">
                    默认发送行尾
                    <select
                      value={isLineEnding(selectedCase.lineEnding) ? selectedCase.lineEnding : "none"}
                      onChange={(event) =>
                        setLineEnding(event.target.value as LineEnding)
                      }
                      disabled={running}
                      className="field"
                    >
                      {Object.entries(lineEndingLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="mt-2 flex items-center gap-1 text-[10px] text-gray-400">
                  <input
                    type="checkbox"
                    checked={selectedCase.sharedChannel !== false}
                    disabled={running}
                    onChange={(event) => setSharedChannel(event.target.checked)}
                  />
                  后续步骤跟随统一通道
                </label>
                <p className="mt-1 text-[9px] text-gray-600">
                  这是步骤的默认值；发送步骤可以单独覆盖。HEX 数据不会自动追加行尾。
                </p>
                <button
                  onClick={() => addStep("command")}
                  disabled={running}
                  className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 py-1.5 text-[10px] font-medium text-cyan-300 disabled:opacity-40"
                >
                  <Plus size={11} />
                  新增发送并断言
                </button>
              </details>
            )}
            {selectedStep?.type === "command" && (
              <section className="max-h-72 shrink-0 overflow-y-auto rounded-xl border border-cyan-500/20 bg-[#0d1117] p-3 scrollbar-thin">
                <div className="grid gap-2">
                  <label className="text-[11px] text-gray-500">
                    发送指令
                    <textarea
                      value={selectedStep.data}
                      onChange={(event) =>
                        updateStep({ data: event.target.value })
                      }
                      disabled={running}
                      rows={2}
                      className="mt-1 block w-full resize-none rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-2 font-mono text-xs text-gray-200 outline-none focus:border-cyan-500"
                    />
                  </label>
                  <div className="grid grid-cols-[1fr_92px] gap-2">
                    <label className="text-[11px] text-gray-500">
                      成功响应
                      <input
                        value={selectedStep.expected ?? "OK"}
                        onChange={(event) =>
                          updateStep({ expected: event.target.value })
                        }
                        disabled={running}
                        className="field"
                      />
                    </label>
                    <label className="text-[11px] text-gray-500">
                      匹配方式
                      <select
                        value={selectedStep.matchMode}
                        onChange={(event) =>
                          updateStep({
                            matchMode: event.target
                              .value as TestStep["matchMode"],
                          })
                        }
                        disabled={running}
                        className="field"
                      >
                        <option value="contains">包含</option>
                        <option value="equals">相等</option>
                        <option value="regex">正则</option>
                      </select>
                    </label>
                  </div>
                  <details className="rounded-lg border border-[#30363d] bg-[#111820] px-2 py-1.5">
                    <summary className="cursor-pointer text-[10px] text-gray-400">
                      高级断言与响应提取{selectedStep.captureName ? ` · ${selectedStep.captureName}` : ""}
                    </summary>
                    <div className="mt-2 grid gap-2 border-t border-[#30363d] pt-2">
                      <label className="text-[11px] text-gray-500">失败响应（正则）<input value={selectedStep.failurePattern ?? "ERROR|FAIL"} onChange={(event) => updateStep({ failurePattern: event.target.value })} disabled={running} className="field" /></label>
                      <div className="grid grid-cols-[92px_1fr] gap-2">
                        <label className="text-[11px] text-gray-500">提取到变量<input value={selectedStep.captureName ?? ""} onChange={(event) => updateStep({ captureName: event.target.value.toUpperCase().replace(/\W/g, "_") })} disabled={running} placeholder="DEVICE_IP" className="field" /></label>
                        <label className="text-[11px] text-gray-500">提取正则（首个捕获组）<input value={selectedStep.captureRegex ?? ""} onChange={(event) => updateStep({ captureRegex: event.target.value })} disabled={running} placeholder={'例如 STAIP,"([^"]+)"'} className="field" /></label>
                      </div>
                    </div>
                  </details>
                  <div className="grid grid-cols-[1fr_82px] gap-2">
                    <label className="text-[11px] text-gray-500">
                      指令发送行尾
                      <select aria-label="指令发送行尾" value={selectedStep.lineEnding ?? "inherit"} onChange={(event) => updateStep({ lineEnding: event.target.value === "inherit" ? undefined : (event.target.value as LineEnding) })} disabled={running || selectedStep.hex} className="field">
                        <option value="inherit">继承用例（{lineEndingLabels[isLineEnding(selectedCase.lineEnding) ? selectedCase.lineEnding : "none"]}）</option>
                        {Object.entries(lineEndingLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                    <label className="text-[11px] text-gray-500">超时 ms<input type="number" value={selectedStep.timeoutMs} onChange={(event) => updateStep({ timeoutMs: Number(event.target.value) })} disabled={running} className="field" /></label>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] text-gray-500">
                      失败后
                      <select
                        value={selectedStep.onFailure ?? "stop"}
                        onChange={(event) =>
                          updateStep({
                            onFailure: event.target
                              .value as TestStep["onFailure"],
                          })
                        }
                        disabled={running}
                        className="ml-2 rounded border border-[#30363d] bg-[#161b22] px-2 py-1 text-xs"
                      >
                        <option value="stop">停止流程</option>
                        <option value="continue">继续执行</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-1 text-[11px] text-gray-400">
                      <input
                        type="checkbox"
                        checked={selectedStep.hex}
                        onChange={(event) =>
                          updateStep({ hex: event.target.checked })
                        }
                        disabled={running}
                      />
                      HEX 指令
                    </label>
                  </div>
                </div>
              </section>
            )}
            {selectedStep && (
              <details className="shrink-0 rounded-xl border border-[#30363d] bg-[#0d1117] px-3 py-2">
                <summary className="cursor-pointer text-[10px] text-gray-400">
                  重试策略 · {selectedStep.retryCount || 0} 次
                </summary>
                <label className="mt-2 flex items-center justify-between gap-3 border-t border-[#30363d] pt-2 text-[11px] text-gray-500">
                  <span>
                    {selectedStep.type === "command"
                      ? "完整指令事务重试"
                      : "步骤失败重试"}
                  </span>
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={selectedStep.retryCount || 0}
                      disabled={running}
                      onChange={(event) =>
                        updateStep({
                          retryCount: Math.max(
                            0,
                            Math.min(10, Number(event.target.value) || 0),
                          ),
                        })
                      }
                      className="w-16 rounded border border-[#30363d] bg-[#161b22] px-2 py-1 text-center text-xs text-gray-200 outline-none"
                    />
                    次
                  </span>
                </label>
              </details>
            )}
            <details className="shrink-0 rounded-xl border border-[#30363d] bg-[#0d1117] px-3 py-2">
              <summary className="cursor-pointer text-[10px] text-gray-400">
                运行上下文 · {selectedFirmwareId ? "已关联固件" : "未关联固件"}{baselineRunId ? " / 已选复测基线" : ""}
              </summary>
              <div className="mt-2 grid gap-2 border-t border-[#30363d] pt-2 sm:grid-cols-2">
                <label className="min-w-0 text-[10px] text-gray-500">
                  已计算固件指纹
                  <select
                    value={selectedFirmwareId}
                    onChange={(event) =>
                      setSelectedFirmwareId(event.target.value)
                    }
                    disabled={running}
                    className="field"
                  >
                    <option value="">不关联固件（仍可运行）</option>
                    {firmwareChoices.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.fileName} · {item.sha256?.slice(0, 12)}…
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0 text-[10px] text-gray-500">
                  修复复测基线
                  <select value={baselineRunId} onChange={(event) => setBaselineRunId(event.target.value)} disabled={running} className="field">
                    <option value="">不比较（仍可运行）</option>
                    {runHistory.filter(item => item.suiteId === selectedSuite?.id && item.caseId === selectedCase?.id).map(item => <option key={item.id} value={item.id}>{new Date(item.startedAt).toLocaleString()} · {item.status}</option>)}
                  </select>
                </label>
              </div>
              <p className="mt-1 text-[9px] text-gray-600">
                仅接受真实计算的 SHA-256；文件名不会被当作固件版本证明。
              </p>
            </details>
            <section className="shrink-0 rounded-xl border border-[#30363d] bg-[#0d1117]">
              <div className="flex items-center justify-between border-b border-[#30363d] bg-[#111820] px-3 py-2 text-xs font-semibold text-gray-300">
                <span>通道配置</span>
                <button aria-label="刷新真实串口" onClick={() => void refreshSerialResources()} disabled={running || serialBusy !== null} className="flex items-center gap-1 rounded border border-[#30363d] px-2 py-1 text-[9px] font-normal text-gray-400 disabled:opacity-40">
                  <RefreshCw size={10} className={serialBusy === "refresh" ? "animate-spin" : ""} />刷新串口
                </button>
              </div>
              <div className="grid gap-2 p-3">
                {serialHandoff && <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-2"><div className="flex items-start gap-2"><Usb size={13} className="mt-0.5 shrink-0 text-cyan-400" /><div className="min-w-0 flex-1"><b className="block text-[10px] text-cyan-200">来自通信调试</b><p className="mt-0.5 truncate text-[9px] text-gray-400">{serialHandoff.path} · {serialHandoff.baudRate} baud</p><p className="mt-1 text-[8px] leading-4 text-gray-600">请明确选择测试通道；绑定不会自动运行流程，也不会关闭原会话。</p></div></div><div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-1"><button onClick={() => void acceptSerialHandoff("serial-a")} disabled={serialBusy !== null || running} className="rounded border border-cyan-500/30 px-2 py-1 text-[9px] text-cyan-300 disabled:opacity-40">绑定串口 A</button><button onClick={() => void acceptSerialHandoff("serial-b")} disabled={serialBusy !== null || running} className="rounded border border-cyan-500/30 px-2 py-1 text-[9px] text-cyan-300 disabled:opacity-40">绑定串口 B</button><button onClick={cancelSerialHandoff} disabled={serialBusy !== null || running} className="rounded border border-[#30363d] px-2 py-1 text-[9px] text-gray-500 disabled:opacity-40">取消</button></div></div>}
                {serialMessage && <p role="status" className="rounded bg-[#111820] px-2 py-1.5 text-[9px] leading-4 text-gray-500">{serialMessage}</p>}
                <div className="grid gap-2">
                  {(["serial-a", "serial-b"] as const).map((channel) => (
                    <div key={channel} className="rounded-lg border border-[#30363d] bg-[#111820] p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0"><b className="block text-[10px] text-cyan-300">{channelLabels[channel]}</b><span className={serialNames[channel] ? "block truncate text-[9px] text-green-400" : "block text-[9px] text-gray-600"}>{serialNames[channel] ?? "未绑定串口会话"}</span></div>
                        <div className="flex shrink-0 gap-1">
                          <button aria-expanded={serialSetupOpen[channel]} aria-controls={`${channel}-serial-setup`} onClick={() => setSerialSetupOpen(previous => ({ ...previous, [channel]: !previous[channel] }))} disabled={running} className="rounded-md border border-[#30363d] px-2 py-1.5 text-[9px] text-gray-400 disabled:opacity-30">{serialNames[channel] ? "更换连接" : "新建或复用连接"}</button>
                          {serialNames[channel] && <button aria-label={`解除${channelLabels[channel]}`} onClick={() => void unbindSerial(channel)} disabled={running} className="rounded-md border border-[#30363d] px-2 py-1.5 text-[9px] text-gray-400 disabled:opacity-30">解除</button>}
                        </div>
                      </div>
                      {serialSetupOpen[channel] && <div id={`${channel}-serial-setup`} className="mt-2 border-t border-[#30363d] pt-2">
                        {serialChoices.length > 0 && <div className="flex items-end gap-1">
                          <label className="min-w-0 flex-1 text-[9px] text-gray-600">复用已连接会话
                            <select aria-label={`${channelLabels[channel]}已有会话`} value={serialSelection[channel] ?? ""} disabled={running} onChange={(event) => setSerialSelection((previous) => ({ ...previous, [channel]: event.target.value || undefined }))} className="field">
                              <option value="">选择已有会话</option>
                              {serialChoices.map((session) => <option key={session.id} value={session.id}>{session.path} · {session.baudRate}</option>)}
                            </select>
                          </label>
                          <button aria-label={`复用${channelLabels[channel]}`} onClick={() => void bindSerial(channel)} disabled={running || !serialSelection[channel]} className="h-[34px] shrink-0 rounded-md border border-[#30363d] px-2 text-[9px] text-gray-400 disabled:opacity-30">复用</button>
                        </div>}
                        <div className={`${serialChoices.length > 0 ? "mt-2" : ""} grid grid-cols-[1fr_92px] gap-1`}>
                          <label className="min-w-0 text-[9px] text-gray-600">新建串口连接
                            <select aria-label={`${channelLabels[channel]}真实串口`} value={serialConfigs[channel].path} disabled={running} onChange={(event) => setSerialConfigs(previous => ({ ...previous, [channel]: { ...previous[channel], path: event.target.value } }))} className="field">
                              <option value="">选择本机端口</option>
                              {serialPorts.map(port => <option key={port.path} value={port.path}>{port.path}{port.friendlyName ? ` · ${port.friendlyName}` : ""}</option>)}
                            </select>
                          </label>
                          <label className="text-[9px] text-gray-600">波特率
                            <input aria-label={`${channelLabels[channel]}波特率`} type="number" min="50" max="4000000" value={serialConfigs[channel].baudRate} disabled={running} onChange={(event) => setSerialConfigs(previous => ({ ...previous, [channel]: { ...previous[channel], baudRate: Math.max(50, Math.min(4_000_000, Number(event.target.value) || 115200)) } }))} className="field" />
                          </label>
                        </div>
                        <details className="mt-1 rounded border border-[#30363d] px-2 py-1">
                          <summary className="cursor-pointer text-[8px] text-gray-500">高级串口参数</summary>
                          <div className="mt-1 grid grid-cols-4 gap-1">
                            <label className="text-[8px] text-gray-600">数据位<select aria-label={`${channelLabels[channel]}数据位`} value={serialConfigs[channel].dataBits} disabled={running} onChange={(event) => setSerialConfigs(previous => ({ ...previous, [channel]: { ...previous[channel], dataBits: Number(event.target.value) as 7 | 8 } }))} className="field"><option value="8">8</option><option value="7">7</option></select></label>
                            <label className="text-[8px] text-gray-600">停止位<select aria-label={`${channelLabels[channel]}停止位`} value={serialConfigs[channel].stopBits} disabled={running} onChange={(event) => setSerialConfigs(previous => ({ ...previous, [channel]: { ...previous[channel], stopBits: Number(event.target.value) as 1 | 2 } }))} className="field"><option value="1">1</option><option value="2">2</option></select></label>
                            <label className="text-[8px] text-gray-600">校验<select aria-label={`${channelLabels[channel]}校验位`} value={serialConfigs[channel].parity} disabled={running} onChange={(event) => setSerialConfigs(previous => ({ ...previous, [channel]: { ...previous[channel], parity: event.target.value as SerialConnectionConfig["parity"] } }))} className="field"><option value="none">无</option><option value="even">偶</option><option value="odd">奇</option></select></label>
                            <label className="text-[8px] text-gray-600">流控<select aria-label={`${channelLabels[channel]}流控`} value={serialConfigs[channel].flowControl} disabled={running} onChange={(event) => setSerialConfigs(previous => ({ ...previous, [channel]: { ...previous[channel], flowControl: event.target.value as SerialConnectionConfig["flowControl"] } }))} className="field"><option value="none">无</option><option value="hardware">硬件</option></select></label>
                          </div>
                        </details>
                        <button aria-label={`连接${channelLabels[channel]}`} onClick={() => void connectSerial(channel)} disabled={running || serialBusy !== null || !serialConfigs[channel].path} className="mt-2 w-full rounded-md border border-cyan-500/30 px-2 py-1.5 text-[9px] text-cyan-300 disabled:opacity-30"><Usb size={10} className="mr-1 inline" />{serialBusy === channel ? "连接中…" : "连接并绑定"}</button>
                      </div>}
                    </div>
                  ))}
                </div>
                <label className="text-[11px] text-gray-500">
                  WebSocket 地址
                  <input
                    value={wsUrl}
                    onChange={(event) => setWsUrl(event.target.value)}
                    className="field"
                  />
                </label>
                <div className="grid gap-2">
                  {(["tcp", "udp"] as const).map((kind) => {
                    const config = networkConfigs[kind];
                    return (
                      <div
                        key={kind}
                        className="grid grid-cols-[38px_76px_1fr_68px_68px] items-end gap-1"
                      >
                        <b className="pb-2 text-[10px] text-blue-400">
                          {kind.toUpperCase()}
                        </b>
                        <label className="text-[9px] text-gray-600">
                          角色
                          <select
                            value={config.mode}
                            onChange={(event) =>
                              setNetworkConfigs((previous) => ({
                                ...previous,
                                [kind]: {
                                  ...config,
                                  mode: event.target.value as
                                    "client" | "server",
                                },
                              }))
                            }
                            className="field"
                          >
                            <option value="client">客户端</option>
                            <option value="server">服务端</option>
                          </select>
                        </label>
                        <label className="text-[9px] text-gray-600">
                          {config.mode === "server" ? "监听地址" : "目标主机"}
                          <input
                            value={config.host}
                            onChange={(event) =>
                              setNetworkConfigs((previous) => ({
                                ...previous,
                                [kind]: { ...config, host: event.target.value },
                              }))
                            }
                            className="field"
                          />
                        </label>
                        <label className="text-[9px] text-gray-600">
                          端口
                          <input
                            type="number"
                            value={config.port}
                            onChange={(event) =>
                              setNetworkConfigs((previous) => ({
                                ...previous,
                                [kind]: { ...config, port: event.target.value },
                              }))
                            }
                            className="field"
                          />
                        </label>
                        <label className="text-[9px] text-gray-600">
                          本地端口
                          <input
                            type="number"
                            value={config.localPort}
                            disabled={config.mode === "server"}
                            onChange={(event) =>
                              setNetworkConfigs((previous) => ({
                                ...previous,
                                [kind]: {
                                  ...config,
                                  localPort: event.target.value,
                                },
                              }))
                            }
                            className="field"
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#30363d] bg-[#090d12]">
              <div className="flex items-center justify-between border-b border-[#30363d] bg-[#111820] px-3 py-2">
                <button
                  onClick={() => setShowHistory((value) => !value)}
                  className={`flex items-center gap-1 text-xs font-semibold ${showHistory ? "text-cyan-300" : "text-gray-300"}`}
                >
                  <History size={11} />
                  {showHistory ? "运行历史" : "执行日志"}
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => exportRunJson()}
                    disabled={!runHistory.length}
                    className="text-[9px] text-gray-500 disabled:opacity-30"
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => exportRunJunit()}
                    disabled={!runHistory.length}
                    className="text-[9px] text-gray-500 disabled:opacity-30"
                  >
                    JUnit
                  </button>
                  <button
                    onClick={() => exportRunCsv()}
                    disabled={!runHistory.length}
                    className="text-[9px] text-gray-500 disabled:opacity-30"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => exportReport()}
                    disabled={!runHistory.length}
                    className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-white disabled:opacity-30"
                  >
                    <Download size={11} />
                    HTML
                  </button>
                </div>
              </div>
              {showHistory && (
                <div className="max-h-40 space-y-1 overflow-y-auto border-b border-[#30363d] p-2 scrollbar-thin">
                  {runComparison && <div role="status" className={`mb-2 rounded border p-2 text-[10px] ${runComparison.comparable ? runComparison.outcome === 'regressed' || runComparison.outcome === 'unchanged-fail' ? 'border-red-500/30 bg-red-500/5 text-red-200' : 'border-green-500/30 bg-green-500/5 text-green-200' : 'border-yellow-500/30 bg-yellow-500/5 text-yellow-200'}`}><div className="flex items-center gap-2"><b>{comparisonLabels[runComparison.outcome]}</b><span>耗时 {runComparison.durationDeltaMs >= 0 ? '+' : ''}{runComparison.durationDeltaMs} ms</span><span>失败项 {runComparison.failedDelta >= 0 ? '+' : ''}{runComparison.failedDelta}</span><button onClick={() => downloadText(`embedkit-comparison-${runComparison.currentRunId}.json`, JSON.stringify(runComparison, null, 2), 'application/json;charset=utf-8')} className="ml-auto text-cyan-300">导出比较</button></div>{runComparison.reasons.length > 0 && <p className="mt-1">{runComparison.reasons.join('；')}</p>}<p className="mt-1 text-gray-500">基线 {runComparison.baselineRunId} → 当前 {runComparison.currentRunId} · 变化步骤 {runComparison.steps.length}</p></div>}
                  {runHistory.length ? (
                    runHistory.map((run) => (
                      <div
                        key={run.id}
                        className="flex items-center gap-2 rounded border border-[#30363d] bg-[#111820] p-2"
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${run.status === "passed" ? "bg-green-400" : run.status === "aborted" ? "bg-yellow-400" : "bg-red-400"}`}
                        />
                        <button
                          onClick={() => {
                            setRunLogs(
                              run.logs.map((log, index) => ({
                                id: index + 1,
                                time: log.time,
                                level: log.level as RunLog["level"],
                                text: log.text,
                              })),
                            );
                            setShowHistory(false);
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <b className="block truncate text-[10px] text-gray-300">
                            {run.caseName}
                          </b>
                          <small className="text-[8px] text-gray-600">
                            {new Date(run.startedAt).toLocaleString()} ·{" "}
                            {run.durationMs} ms
                          </small>
                        </button>
                        <button
                          onClick={() => exportRunJson(run)}
                          className="text-[9px] text-gray-600"
                        >
                          JSON
                        </button>
                        <button
                          onClick={() => exportRunJunit(run)}
                          className="text-[9px] text-gray-600"
                        >
                          XML
                        </button>
                        <button onClick={() => exportRunCsv(run)} className="text-[9px] text-gray-600">CSV</button>
                        <button onClick={() => exportReport(run)} className="text-[9px] text-gray-600">HTML</button>
                        <button
                          onClick={() => void removeRun(run.id)}
                          className="text-red-400"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className="p-2 text-center text-[10px] text-gray-600">
                      暂无运行记录
                    </p>
                  )}
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-y-auto p-2 font-mono text-[11px] leading-5 scrollbar-thin">
                {runLogs.map((log) => (
                  <div key={log.id} className="flex gap-2">
                    <span className="shrink-0 text-gray-700">{log.time}</span>
                    <span
                      className={
                        log.level === "pass"
                          ? "text-green-400"
                          : log.level === "fail"
                            ? "text-red-400"
                            : log.level === "rx"
                              ? "text-green-500"
                              : log.level === "tx"
                                ? "text-blue-400"
                                : "text-gray-400"
                      }
                    >
                      {log.text}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
      {manualConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <section role="dialog" aria-modal="true" aria-label="人工确认" className="w-full max-w-md rounded-xl border border-amber-500/30 bg-[#111820] p-5 shadow-2xl">
            <h2 className="text-base font-semibold text-amber-300">需要人工确认</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-300">{manualConfirmation.message}</p>
            <p className="mt-2 text-[10px] text-gray-600">确认前请检查真实设备状态；操作会记录到本次测试结果。</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => finishManualConfirmation(false)} className="rounded border border-[#30363d] px-4 py-2 text-xs text-gray-400">不通过</button>
              <button onClick={() => finishManualConfirmation(true)} className="rounded bg-amber-600 px-4 py-2 text-xs font-medium text-white">确认通过并继续</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
