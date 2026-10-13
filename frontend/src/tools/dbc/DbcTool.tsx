import { useMemo, useState } from "react";
import { Download, FileUp } from "lucide-react";
import ToolResultRow from "../../features/toolbox/ToolResultRow";
import {
  decodeCanLog,
  decodeDbcMessage,
  filterCanLogFrames,
  parseCanLog,
  parseDbc,
  type DecodedCanLogRow,
} from "./dbc";

const idText = (id: number, extended: boolean) =>
  `0x${id
    .toString(16)
    .toUpperCase()
    .padStart(extended ? 8 : 3, "0")}`;
function exportCsv(result: ReturnType<typeof decodeDbcMessage>) {
  const content = [
    "Signal,Raw,Value,Unit,Enum,InRange",
    ...result.signals.map((item) =>
      [
        item.signal.name,
        item.raw,
        item.value,
        item.signal.unit,
        item.text ?? "",
        item.inRange,
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    ),
  ].join("\r\n");
  const url = URL.createObjectURL(
      new Blob([content], { type: "text/csv;charset=utf-8" }),
    ),
    link = document.createElement("a");
  link.href = url;
  link.download = `${result.message.name}-${idText(result.message.id, result.message.extended)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
const csv = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;
function exportBatchCsv(rows: DecodedCanLogRow[]) {
  const content = [
    [
      "Line",
      "Timestamp",
      "Channel",
      "CAN ID",
      "Message",
      "Signal",
      "Raw",
      "Value",
      "Unit",
      "Enum",
      "InRange",
    ],
    ...rows.map((item) => [
      item.line,
      item.timestamp,
      item.channel,
      idText(item.id, item.extended),
      item.message,
      item.signal,
      item.raw,
      item.value,
      item.unit,
      item.text,
      item.inRange,
    ]),
  ]
    .map((row) => row.map(csv).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(
      new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" }),
    ),
    link = document.createElement("a");
  link.href = url;
  link.download = "dbc-log-decoded.csv";
  link.click();
  URL.revokeObjectURL(url);
}
export default function DbcTool() {
  const [source, setSource] = useState(""),
    [fileName, setFileName] = useState(""),
    [fileError, setFileError] = useState(""),
    [query, setQuery] = useState(""),
    [selectedRawId, setSelectedRawId] = useState<number | null>(null),
    [data, setData] = useState("");
  const [logSource, setLogSource] = useState(""),
    [logId, setLogId] = useState(""),
    [logStart, setLogStart] = useState(""),
    [logEnd, setLogEnd] = useState("");
  const parsed = useMemo(() => {
    if (!source) return { value: null, error: "" };
    try {
      return { value: parseDbc(source), error: "" };
    } catch (error) {
      return {
        value: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, [source]);
  const matches = useMemo(() => {
    if (!parsed.value) return [];
    const keyword = query.trim().toLowerCase();
    return parsed.value.messages
      .filter(
        (message) =>
          !keyword ||
          [
            message.name,
            idText(message.id, message.extended),
            ...message.signals.map((signal) => signal.name),
          ].some((value) => value.toLowerCase().includes(keyword)),
      )
      .slice(0, 300);
  }, [parsed.value, query]);
  const selected =
    parsed.value?.messages.find((item) => item.rawId === selectedRawId) ??
    matches[0] ??
    null;
  const decoded = useMemo(() => {
    if (!selected || !data.trim()) return { value: null, error: "" };
    try {
      return { value: decodeDbcMessage(selected, data), error: "" };
    } catch (error) {
      return {
        value: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, [data, selected]);
  const logResult = useMemo(() => {
    if (!logSource.trim() || !parsed.value)
      return { parsed: null, frames: [], decoded: null, error: "" };
    try {
      const log = parseCanLog(logSource),
        frames = filterCanLogFrames(log.frames, {
          id: logId,
          startTime: logStart.trim() ? Number(logStart) : undefined,
          endTime: logEnd.trim() ? Number(logEnd) : undefined,
        });
      if (
        (logStart.trim() && !Number.isFinite(Number(logStart))) ||
        (logEnd.trim() && !Number.isFinite(Number(logEnd)))
      )
        throw new Error("时间筛选必须是数字时间戳");
      return {
        parsed: log,
        frames,
        decoded: decodeCanLog(parsed.value, frames),
        error: "",
      };
    } catch (error) {
      return {
        parsed: null,
        frames: [],
        decoded: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }, [logEnd, logId, logSource, logStart, parsed.value]);
  const choose = (file?: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setFileError("DBC 文件超过 10 MiB 浏览器解析上限");
      return;
    }
    setFileError("");
    setFileName(file.name);
    setSelectedRawId(null);
    void file.text().then(setSource);
  };
  const chooseLog = (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setFileError("CAN 日志超过 5 MiB 浏览器解析上限");
      return;
    }
    setFileError("");
    void file
      .text()
      .then(setLogSource)
      .catch((error) =>
        setFileError(error instanceof Error ? error.message : String(error)),
      );
  };
  return (
    <>
      {!source && (
        <label className="mb-4 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#30363d] bg-[#0d1117] text-sm text-gray-500 hover:border-blue-500/40">
          <FileUp size={22} className="mb-2" />
          选择 CAN DBC 文件，本地解析且不上传
          <input
            aria-label="导入 DBC 文件"
            type="file"
            accept=".dbc,text/plain"
            className="hidden"
            onChange={(event) => choose(event.target.files?.[0])}
          />
        </label>
      )}
      {source && (
        <div className="mb-3 flex items-center justify-between rounded border border-[#30363d] px-3 py-2 text-xs text-gray-400">
          <span>
            {fileName} · {parsed.value?.messages.length ?? 0} 消息 /{" "}
            {parsed.value?.signalCount ?? 0} 信号
          </span>
          <label className="cursor-pointer text-blue-300">
            更换文件
            <input
              aria-label="更换 DBC 文件"
              type="file"
              accept=".dbc,text/plain"
              className="hidden"
              onChange={(event) => choose(event.target.files?.[0])}
            />
          </label>
        </div>
      )}
      {(fileError || parsed.error) && (
        <p className="mb-3 text-xs text-red-400">{fileError || parsed.error}</p>
      )}
      {parsed.value && (
        <>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索消息名称、CAN ID 或信号名称"
            className="field mb-3"
          />
          <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
            <div className="max-h-[480px] overflow-auto rounded border border-[#30363d]">
              {matches.map((message) => (
                <button
                  key={message.rawId}
                  onClick={() => {
                    setSelectedRawId(message.rawId);
                    setData("");
                  }}
                  className={`block w-full border-b border-[#21262d] px-3 py-2 text-left text-xs ${selected?.rawId === message.rawId ? "bg-blue-500/10 text-blue-200" : "text-gray-400 hover:bg-white/5"}`}
                >
                  <b>{message.name}</b>
                  <span className="mt-1 block font-mono text-[10px] text-gray-600">
                    {idText(message.id, message.extended)} · {message.dlc} B ·{" "}
                    {message.signals.length} signals
                  </span>
                </button>
              ))}
            </div>
            {selected && (
              <div>
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <ToolResultRow
                    label="CAN ID"
                    value={`${idText(selected.id, selected.extended)} ${selected.extended ? "扩展帧" : "标准帧"}`}
                  />
                  <ToolResultRow
                    label="DLC / 发送节点"
                    value={`${selected.dlc} / ${selected.transmitter}`}
                  />
                </div>
                <label className="block text-[11px] text-gray-500">
                  帧数据 HEX（必须与 DLC 一致）
                  <textarea
                    value={data}
                    onChange={(event) => setData(event.target.value)}
                    rows={3}
                    placeholder={Array.from(
                      { length: selected.dlc },
                      () => "00",
                    ).join(" ")}
                    className="field mt-1 resize-y font-mono"
                  />
                </label>
                {decoded.error && (
                  <p className="mt-2 text-xs text-red-400">{decoded.error}</p>
                )}
                {decoded.value && (
                  <>
                    <div className="my-3 flex justify-end">
                      <button
                        onClick={() => exportCsv(decoded.value!)}
                        className="flex items-center gap-1 rounded border border-[#30363d] px-3 py-2 text-xs text-gray-300"
                      >
                        <Download size={13} />
                        导出解码结果
                      </button>
                    </div>
                    <div className="overflow-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-gray-500">
                          <tr>
                            <th className="p-2">信号</th>
                            <th>物理值</th>
                            <th>原始值</th>
                            <th>范围</th>
                          </tr>
                        </thead>
                        <tbody>
                          {decoded.value.signals.map((item) => (
                            <tr
                              key={item.signal.name}
                              className="border-t border-[#21262d]"
                            >
                              <td className="p-2">
                                <b>{item.signal.name}</b>
                                {item.text && (
                                  <span className="ml-2 text-blue-300">
                                    {item.text}
                                  </span>
                                )}
                              </td>
                              <td>
                                {item.value} {item.signal.unit}
                              </td>
                              <td className="font-mono">{item.raw}</td>
                              <td
                                className={
                                  item.inRange
                                    ? "text-green-400"
                                    : "text-red-400"
                                }
                              >
                                {item.inRange
                                  ? "正常"
                                  : `${item.signal.minimum}–${item.signal.maximum} 越界`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <section className="mt-4 rounded border border-[#30363d] bg-[#0d1117] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-xs font-medium text-gray-200">
                  批量 CAN 日志解码
                </h3>
                <p className="mt-1 text-[11px] text-gray-500">
                  支持 candump 的 ID#DATA、ID [DLC] DATA 和带表头
                  CSV；坏行隔离，不会丢弃整批日志。
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#30363d] px-2 py-1 text-[11px] text-gray-400">
                <FileUp size={11} />
                导入日志
                <input
                  aria-label="导入 CAN 日志"
                  type="file"
                  accept=".log,.txt,.csv,text/plain,text/csv"
                  className="hidden"
                  onChange={(event) => chooseLog(event.target.files?.[0])}
                />
              </label>
            </div>
            <textarea
              aria-label="批量 CAN 日志"
              value={logSource}
              onChange={(event) => setLogSource(event.target.value)}
              rows={7}
              className="field mt-3 resize-y font-mono"
              placeholder={
                "(1710000000.125) can0 123#01020304\n1710000001.250 can0 123 [4] 01 02 03 04"
              }
            />
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <label className="text-[10px] text-gray-500">
                CAN ID（十六进制）
                <input
                  aria-label="日志 CAN ID 筛选"
                  value={logId}
                  onChange={(event) => setLogId(event.target.value)}
                  placeholder="例如 123"
                  className="field mt-1 font-mono"
                />
              </label>
              <label className="text-[10px] text-gray-500">
                起始时间戳
                <input
                  aria-label="日志起始时间"
                  value={logStart}
                  onChange={(event) => setLogStart(event.target.value)}
                  placeholder="可选"
                  className="field mt-1 font-mono"
                />
              </label>
              <label className="text-[10px] text-gray-500">
                结束时间戳
                <input
                  aria-label="日志结束时间"
                  value={logEnd}
                  onChange={(event) => setLogEnd(event.target.value)}
                  placeholder="可选"
                  className="field mt-1 font-mono"
                />
              </label>
            </div>
            {logResult.error && (
              <p role="alert" className="mt-2 text-xs text-red-400">
                {logResult.error}
              </p>
            )}
            {logResult.parsed && logResult.decoded && (
              <div className="mt-3">
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
                  <span>有效帧 {logResult.parsed.frames.length}</span>
                  <span>筛选后 {logResult.frames.length}</span>
                  <span>坏行 {logResult.parsed.errorCount}</span>
                  <span>DBC 未匹配 {logResult.decoded.unmatched}</span>
                  <span>解码失败 {logResult.decoded.failed}</span>
                  <span
                    className={
                      logResult.decoded.outOfRange ? "text-red-300" : ""
                    }
                  >
                    越界信号 {logResult.decoded.outOfRange}
                  </span>
                  <button
                    onClick={() => exportBatchCsv(logResult.decoded!.rows)}
                    disabled={!logResult.decoded.rows.length}
                    className="ml-auto inline-flex items-center gap-1 rounded border border-[#30363d] px-2 py-1 text-gray-300 disabled:opacity-30"
                  >
                    <Download size={11} />
                    导出全部 CSV
                  </button>
                </div>
                {(logResult.parsed.truncated ||
                  logResult.decoded.truncated) && (
                  <p className="mt-2 text-[11px] text-yellow-300">
                    结果达到安全上限，已停止继续解析或解码。
                  </p>
                )}
                {(logResult.parsed.errorCount > 0 ||
                  logResult.decoded.errors.length > 0) && (
                  <details className="mt-2 text-[11px] text-yellow-300">
                    <summary>
                      查看失败位置（
                      {logResult.parsed.errorCount +
                        logResult.decoded.errors.length}
                      ）
                    </summary>
                    <ul className="mt-1 max-h-32 list-disc overflow-auto pl-5">
                      {[...logResult.parsed.errors, ...logResult.decoded.errors]
                        .slice(0, 200)
                        .map((item, index) => (
                          <li key={`${item.line}-${index}`}>
                            第 {item.line} 行：{item.message}
                          </li>
                        ))}
                    </ul>
                  </details>
                )}
                <div className="mt-2 max-h-80 overflow-auto rounded border border-[#30363d]">
                  <table className="w-full min-w-[760px] text-left text-[11px]">
                    <thead className="sticky top-0 bg-[#0d1117] text-gray-600">
                      <tr>
                        <th className="px-3 py-2">行 / 时间</th>
                        <th>CAN ID</th>
                        <th>消息 / 信号</th>
                        <th>物理值</th>
                        <th>原始值</th>
                        <th>状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logResult.decoded.rows
                        .slice(0, 1000)
                        .map((item, index) => (
                          <tr
                            key={`${item.line}-${item.signal}-${index}`}
                            className="border-t border-[#30363d]/60"
                          >
                            <td className="px-3 py-2">
                              {item.line} / {item.timestamp ?? "—"}
                            </td>
                            <td className="font-mono">
                              {idText(item.id, item.extended)}
                            </td>
                            <td>
                              {item.message} / {item.signal}
                            </td>
                            <td>
                              {item.value} {item.unit}
                            </td>
                            <td className="font-mono">{item.raw}</td>
                            <td
                              className={
                                item.inRange ? "text-green-400" : "text-red-400"
                              }
                            >
                              {item.inRange ? "正常" : "越界"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {!logResult.decoded.rows.length && (
                    <p className="p-4 text-center text-xs text-gray-600">
                      筛选范围内没有可由当前 DBC 解码的信号。
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
          {parsed.value.warnings.length > 0 && (
            <details className="mt-3 text-xs text-yellow-300">
              <summary>解析警告（{parsed.value.warnings.length}）</summary>
              <ul className="mt-2 list-disc pl-5">
                {parsed.value.warnings.slice(0, 100).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </>
  );
}
