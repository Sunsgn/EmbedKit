import { detectExecutionModel } from './executionAdapters.ts';

export interface ArchitectureFile { name: string; path: string; content: string }
export type ArchitectureNodeKind = 'entry' | 'init' | 'task' | 'interrupt' | 'callback' | 'service' | 'protocol' | 'driver' | 'config' | 'module';
export interface ArchitectureCallSite { name: string; line: number; order: number; control: 'sequence' | 'loop' | 'branch'; condition?: string }
export interface ArchitectureNode { id: string; name: string; kind: ArchitectureNodeKind; file: string; line: number; evidence: string; calls: string[]; callSites: ArchitectureCallSite[] }
export interface ArchitectureLayer { id: string; name: string; description: string; files: string[]; nodes: ArchitectureNode[] }
export interface ArchitectureEdge { from: string; to: string; type: 'calls' | 'creates' | 'includes' }
export interface ExecutionFlowStep { id: string; name: string; file: string; line: number; depth: number; relation: 'start' | 'call' | 'create' | 'external' | 'cycle' | 'ambiguous'; control: 'sequence' | 'loop' | 'branch'; condition?: string; internal: boolean }
export interface ExecutionFlow { id: string; title: string; context: 'startup' | 'task' | 'interrupt' | 'callback'; root: ArchitectureNode; steps: ExecutionFlowStep[]; confidence: 'high' | 'medium' | 'low'; notes: string[] }
export interface ArchitectureCoverage { sourceFiles: number; parsedFunctions: number; callSites: number; resolvedCallSites: number; resolvedRate: number }
export interface ArchitectureAmbiguity { name: string; definitions: Array<{ file: string; line: number }>; callSites: number }
export interface ProjectArchitecture {
  runtime: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string[];
  entries: ArchitectureNode[];
  tasks: ArchitectureNode[];
  interrupts: ArchitectureNode[];
  callbacks: ArchitectureNode[];
  initChain: ArchitectureNode[];
  layers: ArchitectureLayer[];
  edges: ArchitectureEdge[];
  flows: ExecutionFlow[];
  unknownCalls: number;
  coverage: ArchitectureCoverage;
  ambiguities: ArchitectureAmbiguity[];
}

const stripComments = (value: string) => value
  .replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, ' '))
  .replace(/\/\/.*$/gm, match => ' '.repeat(match.length))
  .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, match => match.replace(/[^\n]/g, ' '));
const lineOf = (content: string, offset: number) => content.slice(0, offset).split(/\r?\n/).length;
const nodeId = (file: string, name: string, line: number) => `${file}:${line}:${name}`;

function controlBlocks(body: string) {
  const blocks: Array<{ start: number; end: number; control: 'loop' | 'branch'; condition: string }> = [];
  const pattern = /\b(if|else\s+if|switch|while|for)\s*\(/g;
  for (const match of body.matchAll(pattern)) {
    const conditionStart = (match.index ?? 0) + match[0].length;
    let parentheses = 1, cursor = conditionStart;
    while (cursor < body.length && parentheses) { if (body[cursor] === '(') parentheses += 1; else if (body[cursor] === ')') parentheses -= 1; cursor += 1; }
    const conditionEnd = cursor - 1;
    while (/\s/.test(body[cursor] ?? '')) cursor += 1;
    if (body[cursor] !== '{') continue;
    const brace = cursor;
    let depth = 1; cursor = brace + 1;
    while (cursor < body.length && depth) { if (body[cursor] === '{') depth += 1; else if (body[cursor] === '}') depth -= 1; cursor += 1; }
    blocks.push({ start: brace, end: cursor, control: /while|for/.test(match[1]) ? 'loop' : 'branch', condition: `${match[1].replace(/\s+/g, ' ')} (${body.slice(conditionStart, conditionEnd).trim().replace(/\s+/g, ' ').slice(0, 80)})` });
  }
  return blocks;
}

function flowFor(root: ArchitectureNode, context: ExecutionFlow['context'], definitions: Map<string, ArchitectureNode>, createdTasks: Map<string, string[]>, ambiguousNames: Set<string>): ExecutionFlow {
  const steps: ExecutionFlowStep[] = [{ id: `${root.id}:start`, name: root.name, file: root.file, line: root.line, depth: 0, relation: 'start', control: 'sequence', internal: true }];
  const notes: string[] = [];
  const expand = (node: ArchitectureNode, depth: number, path: Set<string>) => {
    if (depth >= 5 || steps.length >= 80) { if (!notes.includes('调用链超过展示深度，已截断。')) notes.push('调用链超过展示深度，已截断。'); return; }
    for (const site of node.callSites) {
      if (steps.length >= 80) break;
      const target = definitions.get(site.name);
      const created = createdTasks.get(`${node.id}:${site.order}`) ?? [];
      if (created.length) {
        for (const taskName of created) {
          const task = definitions.get(taskName);
          steps.push({ id: `${node.id}:${site.order}:create:${taskName}`, name: `创建任务 ${taskName}`, file: task?.file ?? node.file, line: task?.line ?? site.line, depth: depth + 1, relation: 'create', control: site.control, condition: site.condition, internal: Boolean(task) });
        }
        continue;
      }
      if (target) {
        const cycle = path.has(target.id);
        steps.push({ id: `${node.id}:${site.order}:${target.id}`, name: target.name, file: target.file, line: target.line, depth: depth + 1, relation: cycle ? 'cycle' : 'call', control: site.control, condition: site.condition, internal: true });
        if (!cycle) expand(target, depth + 1, new Set([...path, target.id]));
      } else if (ambiguousNames.has(site.name)) {
        steps.push({ id: `${node.id}:${site.order}:ambiguous`, name: `${site.name} （多定义）`, file: node.file, line: site.line, depth: depth + 1, relation: 'ambiguous', control: site.control, condition: site.condition, internal: false });
      } else if (!/^[A-Z][A-Z0-9_]+$/.test(site.name)) {
        steps.push({ id: `${node.id}:${site.order}:external`, name: site.name, file: node.file, line: site.line, depth: depth + 1, relation: 'external', control: site.control, condition: site.condition, internal: false });
      }
    }
  };
  expand(root, 0, new Set([root.id]));
  if (steps.some(step => step.relation === 'cycle')) notes.push('检测到递归或循环调用，已停止继续展开。');
  if (steps.some(step => step.relation === 'ambiguous')) notes.push('同名函数存在多个定义，缺少编译单元和链接信息时不做猜测。');
  if (context === 'task') notes.push('该任务与其他任务并发执行，任务间先后顺序由调度器和同步对象决定。');
  if (context === 'interrupt') notes.push('中断触发时机由硬件决定，不属于主流程的固定顺序。');
  if (context === 'callback') notes.push('回调由外设、协议栈或事件循环触发，静态分析不能确定其运行时机和上下文。');
  const resolved = steps.filter(step => step.internal).length, confidence = resolved >= 4 ? 'high' : resolved >= 2 ? 'medium' : 'low';
  return { id: `flow:${root.id}`, title: context === 'startup' ? `${root.name} 启动与主循环` : context === 'task' ? `${root.name} 任务流程` : context === 'callback' ? `${root.name} 回调流程` : `${root.name} 中断流程`, context, root, steps, confidence, notes };
}

function kindForFunction(name: string): ArchitectureNodeKind {
  if (/^(?:main|app_main|setup|loop)$/i.test(name)) return 'entry';
  if (/(?:IRQHandler|_ISR|ISR$|Interrupt|Callback$)/i.test(name)) return 'interrupt';
  if (/(?:Task|Thread|Process)(?:Main|Entry|Handler)?$/i.test(name)) return 'task';
  if (/(?:Init|Setup|Config|Initialize)$/i.test(name) || /^(?:MX_|BSP_).+_Init$/i.test(name)) return 'init';
  if (/(?:uart|usart|spi|i2c|can|gpio|adc|pwm|timer|dma|flash)/i.test(name)) return 'driver';
  if (/(?:mqtt|modbus|http|coap|ble|tcp|udp|protocol|packet|frame)/i.test(name)) return 'protocol';
  if (/(?:service|manager|controller|monitor)/i.test(name)) return 'service';
  return 'module';
}

function classifyFile(file: ArchitectureFile) {
  const value = `${file.path} ${file.content.slice(0, 3000)}`.toLowerCase();
  if (/\.(?:h|hpp|json|yaml|yml|ini|conf)$/i.test(file.name) || /(?:config|kconfig|sdkconfig)/.test(value)) return 'config';
  if (/(?:\/|\\)(?:bsp|board|boards|hal|ll|cmsis)(?:\/|\\)/.test(value)) return 'driver';
  if (/(?:\/|\\)(?:driver|drivers|device)(?:\/|\\)/.test(value) || /\bHAL_(?:UART|SPI|I2C|GPIO|ADC|CAN)/i.test(file.content)) return 'driver';
  if (/(?:mqtt|modbus|http|coap|tcp|udp|protocol|packet|frame)/.test(value)) return 'protocol';
  if (/(?:freertos|rt-thread|zephyr|threadx|middleware|lwip|mbedtls)/.test(value)) return 'service';
  if (/(?:service|manager|controller|application|\/app\/|\/src\/)/.test(value)) return 'service';
  return 'module';
}

function runtimeOf(content: string) {
  return detectExecutionModel(content).label;
}

export function analyzeProjectArchitecture(files: ArchitectureFile[]): ProjectArchitecture {
  const sources = files.filter(file => /\.(?:c|cc|cpp|h|hpp|s|S)$/i.test(file.name));
  const allContent = sources.map(file => file.content).join('\n');
  const definitionCandidates = new Map<string, ArchitectureNode[]>(),
    parsedNodes: ArchitectureNode[] = [];
  const bodies = new Map<string, string>();
  for (const file of sources) {
    const content = stripComments(file.content);
    const pattern = /(?:^|\n)\s*(?:[\w:*<>]+\s+)+(\w+)\s*\([^;{}]*\)\s*\{/g;
    for (const match of content.matchAll(pattern)) {
      const name = match[1], start = (match.index ?? 0) + match[0].lastIndexOf('{');
      let depth = 1, cursor = start + 1;
      while (cursor < content.length && depth) { if (content[cursor] === '{') depth += 1; else if (content[cursor] === '}') depth -= 1; cursor += 1; }
      const body = content.slice(start + 1, cursor - 1), line = lineOf(content, match.index ?? 0), kind = kindForFunction(name);
      const blocks = controlBlocks(body);
      const rawCalls = [...body.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)].filter(item => !['if', 'for', 'while', 'switch', 'sizeof', 'return'].includes(item[1]));
      const callSites = rawCalls.map((item, order) => {
        const offset = item.index ?? 0, containing = blocks.filter(block => offset > block.start && offset < block.end), block = containing.sort((a, b) => b.start - a.start)[0];
        return { name: item[1], line: lineOf(content, start + 1 + offset), order, control: block?.control ?? 'sequence', condition: block?.condition } satisfies ArchitectureCallSite;
      });
      const node = { id: nodeId(file.path, name, line), name, kind, file: file.path, line, evidence: `${name}(...)`, calls: [...new Set(callSites.map(item => item.name))], callSites } satisfies ArchitectureNode;
      parsedNodes.push(node);
      definitionCandidates.set(name, [...(definitionCandidates.get(name) ?? []), node]);
      bodies.set(name, body);
    }
  }
  const ambiguousNames = new Set(
      [...definitionCandidates].filter(([, items]) => items.length > 1).map(([name]) => name),
    ),
    definitions = new Map(
      [...definitionCandidates]
        .filter(([, items]) => items.length === 1)
        .map(([name, items]) => [name, items[0]]),
    );
  const taskNames = new Set<string>();
  const taskPatterns = [
    /(?:xTaskCreate|xTaskCreateStatic|osThreadNew|osThreadCreate)\s*\(\s*&?([A-Za-z_]\w*)/g,
    /rt_thread_create\s*\(\s*[^,]+,\s*&?([A-Za-z_]\w*)/g,
    /tx_thread_create\s*\(\s*[^,]+,\s*[^,]+,\s*&?([A-Za-z_]\w*)/g,
    /k_thread_create\s*\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*&?([A-Za-z_]\w*)/g,
    /K_THREAD_DEFINE\s*\([^,]+,[^,]+,\s*([A-Za-z_]\w*)/g,
    /(?:OSTaskCreate|OSTaskCreateExt)\s*\(\s*&?([A-Za-z_]\w*)/g,
    /OS_(?:TASK_CreateEx|CreateTask)\s*\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*&?([A-Za-z_]\w*)/g,
    /pthread_create\s*\(\s*[^,]+,\s*[^,]+,\s*&?([A-Za-z_]\w*)/g,
    /task_create\s*\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*&?([A-Za-z_]\w*)/g,
    /krhino_task_create\s*\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*&?([A-Za-z_]\w*)/g,
  ];
  for (const pattern of taskPatterns) for (const match of allContent.matchAll(pattern)) taskNames.add(match[1]);
  for (const name of taskNames) { const node = definitions.get(name); if (node) definitions.set(name, { ...node, kind: 'task' }); }
  const callbackNames = new Set<string>(),
    callbackPattern = /\b((?:HAL_\w+_RegisterCallback|esp_event_handler_register|mqtt_client_register_event|register_\w+_callback|set_\w+_callback))\s*\(([^;]{0,600})\)/gi;
  for (const match of allContent.matchAll(callbackPattern)) {
    const callback = match[2]
      .split(',')
      .map(item => item.trim().replace(/^&/, ''))
      .reverse()
      .find(item => /^[A-Za-z_]\w*$/.test(item));
    if (callback) callbackNames.add(callback);
  }
  for (const name of callbackNames) {
    const node = definitions.get(name);
    if (node && node.kind === 'module')
      definitions.set(name, { ...node, kind: 'callback' });
  }
  const nodes = parsedNodes.map(node => definitions.get(node.name) ?? node);
  const createdTasks = new Map<string, string[]>();
  for (const node of nodes) {
    const body = bodies.get(node.name) ?? '';
    const creationPattern = /\b(xTaskCreateStatic|xTaskCreate|osThreadNew|osThreadCreate|rt_thread_create|rt_thread_init|tx_thread_create|k_thread_create|OSTaskCreateExt|OSTaskCreate|OS_TASK_CreateEx|OS_CreateTask|pthread_create|task_create|krhino_task_create|LOS_TaskCreate)\s*\(([^;]{0,1000})\)/g;
    const usedOrders = new Set<number>();
    for (const match of body.matchAll(creationPattern)) {
      const site = node.callSites.find(item => item.name === match[1] && !usedOrders.has(item.order));
      if (!site) continue;
      usedOrders.add(site.order);
      const created = [...taskNames].filter(name => new RegExp(`\\b${name}\\b`).test(match[2]));
      if (created.length) createdTasks.set(`${node.id}:${site.order}`, created);
    }
  }
  const entries = nodes.filter(node => node.kind === 'entry');
  const tasks = nodes.filter(node => node.kind === 'task');
  const interrupts = nodes.filter(node => node.kind === 'interrupt');
  const callbacks = nodes.filter(node => node.kind === 'callback');
  const initNames = new Set(entries.flatMap(entry => entry.calls.filter(call => /(?:Init|Setup|Config|Initialize)$/i.test(call) || /^(?:MX_|BSP_).+_Init$/i.test(call))));
  const initChain = [...initNames].map(name => definitions.get(name)).filter((node): node is ArchitectureNode => Boolean(node));
  const edges: ArchitectureEdge[] = [];
  let unknownCalls = 0;
  for (const node of nodes) for (const call of node.calls) {
    const target = definitions.get(call);
    if (target) edges.push({ from: node.id, to: target.id, type: 'calls' });
    else unknownCalls += 1;
  }
  for (const [key, names] of createdTasks) {
    const ownerId = key.slice(0, key.lastIndexOf(':'));
    for (const name of names) { const target = definitions.get(name); if (target) edges.push({ from: ownerId, to: target.id, type: 'creates' }); }
  }
  for (const file of sources) for (const match of file.content.matchAll(/^\s*#\s*include\s*["<]([^">]+)[">]/gm)) {
    const included = files.find(candidate => candidate.name.toLowerCase() === match[1].replace(/\\/g, '/').split('/').pop()?.toLowerCase());
    if (included) edges.push({ from: file.path, to: included.path, type: 'includes' });
  }
  const layerMeta: Array<[ArchitectureNodeKind | 'module', string, string]> = [
    ['entry', '启动与应用入口', '启动、系统初始化和主循环'],
    ['task', '任务与并发', 'RTOS任务、线程和后台处理'],
    ['service', '业务与系统服务', '控制器、管理器和中间件'],
    ['protocol', '协议与通信', '网络协议、设备协议和数据编解码'],
    ['driver', '驱动与硬件抽象', 'BSP、HAL和外设访问'],
    ['interrupt', '中断与回调', 'IRQ、ISR和异步回调'],
    ['callback', '事件回调', '协议栈、驱动和事件循环注册的回调'],
    ['config', '配置', '编译、芯片和功能配置'],
    ['module', '其他模块', '尚未归类的工程模块'],
  ];
  const layers = layerMeta.map(([id, name, description]) => {
    const layerFiles = sources.filter(file => classifyFile(file) === id || (id === 'entry' && entries.some(node => node.file === file.path)) || (id === 'task' && tasks.some(node => node.file === file.path)) || (id === 'interrupt' && interrupts.some(node => node.file === file.path)) || (id === 'callback' && callbacks.some(node => node.file === file.path)));
    const layerNodes = nodes.filter(node => node.kind === id);
    return { id, name, description, files: [...new Set(layerFiles.map(file => file.path))], nodes: layerNodes };
  }).filter(layer => layer.files.length || layer.nodes.length);
  const runtime = runtimeOf(files.map(file => `${file.path}\n${file.content}`).join('\n'));
  const flows = [...entries.map(node => flowFor(node, 'startup' as const, definitions, createdTasks, ambiguousNames)), ...tasks.map(node => flowFor(node, 'task' as const, definitions, createdTasks, ambiguousNames)), ...interrupts.map(node => flowFor(node, 'interrupt' as const, definitions, createdTasks, ambiguousNames)), ...callbacks.map(node => flowFor(node, 'callback' as const, definitions, createdTasks, ambiguousNames))];
  const callSites = nodes.flatMap(node => node.callSites),
    resolvedCallSites = callSites.filter(site => definitions.has(site.name)).length,
    coverage = {
      sourceFiles: sources.length,
      parsedFunctions: nodes.length,
      callSites: callSites.length,
      resolvedCallSites,
      resolvedRate: callSites.length ? resolvedCallSites / callSites.length : 0,
    },
    ambiguities = [...definitionCandidates]
      .filter(([, items]) => items.length > 1)
      .map(([name, items]) => ({
        name,
        definitions: items.map(item => ({ file: item.file, line: item.line })),
        callSites: callSites.filter(site => site.name === name).length,
      }));
  const evidence = [runtime !== '未确定执行模型' ? `运行模型：${runtime}` : '', entries.length ? `入口 ${entries.map(item => item.name).join('、')}` : '', tasks.length ? `${tasks.length} 个任务/线程` : '', interrupts.length ? `${interrupts.length} 个中断` : '', callbacks.length ? `${callbacks.length} 个注册回调` : '', ambiguities.length ? `${ambiguities.length} 个同名定义歧义` : '', callSites.length ? `调用解析率 ${(coverage.resolvedRate * 100).toFixed(0)}%` : '', edges.length ? `${edges.length} 条静态依赖` : ''].filter(Boolean);
  const score = (runtime !== '未确定执行模型' ? 25 : 0) + (entries.length ? 25 : 0) + (nodes.length >= 5 ? 20 : nodes.length ? 10 : 0) + (edges.length ? 20 : 0) + (layers.length >= 3 ? 10 : 0) - Math.min(20, ambiguities.length * 5);
  return { runtime, confidence: score >= 75 ? 'high' : score >= 45 ? 'medium' : 'low', evidence, entries, tasks, interrupts, callbacks, initChain, layers, edges, flows, unknownCalls, coverage, ambiguities };
}
