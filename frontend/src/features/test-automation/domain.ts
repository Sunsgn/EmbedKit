export type Channel = 'serial-a' | 'serial-b' | 'websocket' | 'tcp' | 'udp';
export type StepType = 'command' | 'send' | 'wait' | 'match' | 'delay' | 'wait-online' | 'clear-buffer' | 'set-variable' | 'manual';
export type StepStatus = 'idle' | 'running' | 'passed' | 'failed' | 'skipped';
export type StepStage = 'setup' | 'test' | 'teardown';
export type LineEnding = 'none' | 'cr' | 'lf' | 'crlf';

export interface TestStep {
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
  retryDelayMs?: number;
  retryTimeLimitMs?: number;
  matchMode: 'contains' | 'equals' | 'regex';
  expected?: string;
  failurePattern?: string;
  captureName?: string;
  captureRegex?: string;
  onFailure?: 'stop' | 'continue';
  lineEnding?: LineEnding;
}

export interface TestCase { id: string; name: string; steps: TestStep[]; sharedChannel?: boolean; channel?: Channel; lineEnding?: LineEnding }
export interface FlowVariable { id: string; name: string; value: string; secret: boolean }
export interface TestSuite { id: string; name: string; cases: TestCase[]; variables?: FlowVariable[] }
export interface RunLog { id: number; time: string; level: 'info' | 'pass' | 'fail' | 'rx' | 'tx'; text: string }
export interface Incoming { channel: Channel; text: string; hex: string }
export interface SerialRuntime { id: string; after: number; path: string; polling: boolean }
export interface SerialConnectionConfig { path: string; baudRate: number; dataBits: 7 | 8; stopBits: 1 | 2; parity: 'none' | 'even' | 'odd'; flowControl: 'none' | 'hardware' }
export interface NetworkConfig { mode: 'client' | 'server'; host: string; port: string; localPort: string }

const STEP_NAMES: Record<StepType, string> = { command: '发送并断言', send: '发送数据', wait: '等待响应', match: '匹配响应', delay: '延时', 'wait-online': '等待通道在线', 'clear-buffer': '清空接收缓冲', 'set-variable': '设置变量', manual: '人工确认' };

export const isLineEnding = (value: unknown): value is LineEnding => value === 'none' || value === 'crlf' || value === 'cr' || value === 'lf';

export const createTestStep = (type: StepType = 'command'): TestStep => ({
  id: crypto.randomUUID(), name: STEP_NAMES[type], type, stage: 'test', channel: 'serial-a',
  data: type === 'command' ? 'AT' : type === 'match' ? 'OK' : type === 'manual' ? '请确认设备状态正常后继续' : '',
  expected: type === 'command' ? 'OK' : '', failurePattern: 'ERROR|FAIL', captureName: type === 'set-variable' ? 'VARIABLE' : '', captureRegex: '', onFailure: 'stop', hex: false,
  durationMs: 500, timeoutMs: 3000, retryCount: type === 'command' ? 1 : 0, retryDelayMs: 1000, retryTimeLimitMs: 5 * 60 * 1000, matchMode: 'contains',
});

export const createAtNetworkCase = (): TestCase => {
  const command = (name: string, data: string, expected = 'OK', timeoutMs = 3000, extra: Partial<TestStep> = {}): TestStep => ({ ...createTestStep('command'), name, data, expected, timeoutMs, ...extra });
  return { id: crypto.randomUUID(), name: 'ESP-AT 模组联网流程', sharedChannel: true, channel: 'serial-a', lineEnding: 'crlf', steps: [
    command('检测模组', 'AT'), command('关闭指令回显', 'ATE0'), command('设置 Station 模式', 'AT+CWMODE=1'),
    command('连接 Wi-Fi', 'AT+CWJAP="{{SSID}}","{{PASSWORD}}"', 'WIFI GOT IP|OK', 20000, { matchMode: 'regex', retryCount: 2 }),
    command('读取并保存 IP 地址', 'AT+CIFSR', 'STAIP,', 5000, { captureName: 'DEVICE_IP', captureRegex: 'STAIP,"([^"]+)"' }),
  ] };
};

export const createDefaultTestSuites = (): TestSuite[] => [{ id: crypto.randomUUID(), name: '设备通信测试', variables: [], cases: [{ id: crypto.randomUUID(), name: '启动与响应', sharedChannel: true, channel: 'serial-a', lineEnding: 'none', steps: [createTestStep('command')] }] }];

export const resolveFlowVariables = (value: string, variables: FlowVariable[] = []) => value.replace(/\{\{([A-Za-z_][\w]*)\}\}/g, (token, name: string) => variables.find(item => item.name === name)?.value ?? token);
export const applyLineEnding = (value: string, lineEnding: LineEnding = 'none') => lineEnding === 'none' ? value : `${value.replace(/(?:\r\n|\r|\n)$/, '')}${lineEnding === 'crlf' ? '\r\n' : lineEnding === 'cr' ? '\r' : '\n'}`;
