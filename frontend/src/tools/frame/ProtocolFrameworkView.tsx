import type { ProtocolFramework } from './protocolFramework';

const familyLabels: Record<string, string> = { 'modbus-rtu': 'Modbus RTU', 'modbus-tcp': 'Modbus TCP', canopen: 'CANopen', j1939: 'SAE J1939', uds: 'UDS / ISO 14229', lin: 'LIN', 'at-command': 'AT 命令', 'custom-binary': '自定义二进制' };
const transportLabels: Record<string, string> = { uart: 'UART', rs232: 'RS-232', rs485: 'RS-485', tcp: 'TCP', udp: 'UDP', can: 'CAN', lin: 'LIN', i2c: 'I²C', spi: 'SPI', usb: 'USB', ble: 'BLE' };
const interactionLabels: Record<string, string> = { 'request-response': '请求/响应', 'master-slave': '主从', 'publish-subscribe': '发布/订阅', 'periodic-report': '周期上报', 'event-report': '事件上报' };
const directionLabels: Record<string, string> = { request: '请求', response: '响应', report: '上报', bidirectional: '双向', unknown: '方向未知' };
const roleLabels: Record<string, string> = { header: '帧头', address: '地址', length: '长度', sequence: '序号', command: '命令', payload: '负载', checksum: '校验', tail: '帧尾', other: '其他' };
const labels = (values: string[], dictionary: Record<string, string>) => values.map(value => dictionary[value] ?? value).join('、') || '未识别';
const position = (source: { line: number; location?: string }) => source.location ?? `第 ${source.line} 行`;

export default function ProtocolFrameworkView({ framework }: { framework: ProtocolFramework }) {
  return <section aria-label="协议框架识别结果" className="mt-3 rounded border border-purple-500/20 bg-purple-500/5 p-2">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px]"><b className="text-purple-300">协议框架</b><span>协议族：{labels(framework.families, familyLabels)}</span><span>传输：{labels(framework.transports, transportLabels)}</span><span>交互：{labels(framework.interactions, interactionLabels)}</span><span className="text-gray-500">可信度 {Math.round(framework.confidence * 100)}%</span></div>
    {framework.unknowns.length > 0 && <p className="mt-2 text-[10px] text-yellow-300">待确认：{framework.unknowns.join('；')}</p>}
    {framework.frameSegments.length > 0 && <div className="mt-2 overflow-auto"><p className="mb-1 text-[10px] font-medium text-gray-400">帧布局</p><table className="w-full min-w-[440px] text-left text-[10px]"><thead className="text-gray-600"><tr><th>顺序</th><th>字段</th><th>角色</th><th>偏移/长度</th><th>来源</th></tr></thead><tbody>{framework.frameSegments.map((segment, index) => <tr key={segment.id} className="border-t border-purple-500/10"><td>{index + 1}</td><td className="text-gray-300">{segment.name}</td><td>{roleLabels[segment.role]}</td><td>{segment.offset ?? '可变'} / {segment.length ?? '可变'}</td><td title={segment.source.text}>{position(segment.source)}</td></tr>)}</tbody></table></div>}
    {framework.messages.length > 0 && <div className="mt-2 overflow-auto"><p className="mb-1 text-[10px] font-medium text-gray-400">命令 / 消息目录（{framework.messages.length}）</p><table className="w-full min-w-[400px] text-left text-[10px]"><thead className="text-gray-600"><tr><th>命令</th><th>名称</th><th>方向</th><th>来源</th></tr></thead><tbody>{framework.messages.map(message => <tr key={message.id} className="border-t border-purple-500/10"><td className="font-mono text-blue-300">{message.command === null ? '未知' : `0x${message.command.toString(16).toUpperCase()}`}</td><td className="text-gray-300">{message.name}</td><td>{directionLabels[message.direction]}</td><td title={message.source.text}>{position(message.source)}</td></tr>)}</tbody></table></div>}
  </section>;
}
