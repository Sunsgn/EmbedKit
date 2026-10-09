import { TASK_API_PATTERN, taskSpec } from './executionAdapters.ts';

export interface BehaviorFile { name: string; path: string; content: string }
export interface StateTransition { from: string; to: string; event?: string; file: string; line: number }
export interface StateMachine { id: string; name: string; variable: string; file: string; line: number; states: string[]; transitions: StateTransition[]; confidence: 'high' | 'medium' | 'low' }
export type ResourceKind = 'queue' | 'mutex' | 'semaphore' | 'event' | 'timer';
export interface ConcurrencyResource { id: string; name: string; kind: ResourceKind; file: string; line: number; createdBy?: string; writers: string[]; readers: string[]; operations: Array<{ operation: string; function?: string; file: string; line: number }> }
export interface TaskProfile { name: string; api: string; file: string; line: number; stack?: string; priority?: string; entry?: string }
export interface CallbackRegistration { callback: string; source: string; api: string; file: string; line: number }
export interface ProgramBehavior { stateMachines: StateMachine[]; resources: ConcurrencyResource[]; tasks: TaskProfile[]; callbacks: CallbackRegistration[]; metadata: { compileCommands: boolean; keilProject: boolean; iarProject: boolean; confidence: 'high' | 'medium' | 'low'; evidence: string[] } }

const lineOf = (content: string, offset: number) => content.slice(0, offset).split(/\r?\n/).length;
const clean = (value: string) => value.replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\n]/g, ' ')).replace(/\/\/.*$/gm, match => ' '.repeat(match.length));

function matchingBrace(content: string, start: number) {
  let depth = 1, cursor = start + 1;
  while (cursor < content.length && depth) { if (content[cursor] === '{') depth += 1; else if (content[cursor] === '}') depth -= 1; cursor += 1; }
  return cursor;
}

function enclosingFunction(content: string, offset: number) {
  const prefix = content.slice(0, offset), definitions = [...prefix.matchAll(/(?:^|\n)\s*(?:[\w:*<>]+\s+)+(\w+)\s*\([^;{}]*\)\s*\{/g)];
  return definitions.at(-1)?.[1];
}

function analyzeStateMachines(files: BehaviorFile[]) {
  const result: StateMachine[] = [];
  for (const file of files.filter(item => /\.(?:c|cc|cpp|h|hpp)$/i.test(item.name))) {
    const content = clean(file.content), pattern = /\bswitch\s*\(\s*([A-Za-z_]\w*(?:\s*->\s*\w+|\s*\.\s*\w+)?)\s*\)\s*\{/g;
    for (const match of content.matchAll(pattern)) {
      const start = (match.index ?? 0) + match[0].lastIndexOf('{'), end = matchingBrace(content, start), body = content.slice(start + 1, end - 1);
      const cases = [...body.matchAll(/\bcase\s+([A-Za-z_]\w*)\s*:/g)];
      if (cases.length < 2) continue;
      const states = [...new Set(cases.map(item => item[1]))], transitions: StateTransition[] = [];
      cases.forEach((item, index) => {
        const blockStart = (item.index ?? 0) + item[0].length, blockEnd = cases[index + 1]?.index ?? body.length, block = body.slice(blockStart, blockEnd);
        const escaped = match[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
        for (const assignment of block.matchAll(new RegExp(`${escaped}\\s*=\\s*([A-Za-z_]\\w*)`, 'g'))) {
          const before = block.slice(Math.max(0, (assignment.index ?? 0) - 160), assignment.index ?? 0), condition = before.match(/\bif\s*\(([^)]*)\)[^{;]*\{?\s*$/)?.[1]?.trim();
          transitions.push({ from: item[1], to: assignment[1], event: condition, file: file.path, line: lineOf(content, start + 1 + blockStart + (assignment.index ?? 0)) });
        }
      });
      const name = enclosingFunction(content, match.index ?? 0) ?? `${match[1]} 状态机`;
      result.push({ id: `${file.path}:${lineOf(content, match.index ?? 0)}:${match[1]}`, name, variable: match[1].replace(/\s+/g, ''), file: file.path, line: lineOf(content, match.index ?? 0), states, transitions, confidence: transitions.length ? 'high' : 'medium' });
    }
  }
  return result;
}

const resourceKind = (api: string): ResourceKind | undefined => /Queue|MsgQ|msgq|\bmq_|_queue_/i.test(api) ? 'queue' : /Mutex|mutex/i.test(api) ? 'mutex' : /Sem|Semaphore|sem_/i.test(api) ? 'semaphore' : /Event|Flag/i.test(api) ? 'event' : /Timer|timer/i.test(api) ? 'timer' : undefined;

function analyzeResources(files: BehaviorFile[]) {
  const resources = new Map<string, ConcurrencyResource>();
  const ensure = (name: string, kind: ResourceKind, file: BehaviorFile, offset: number) => {
    const key = `${kind}:${name}`, current = resources.get(key) ?? { id: key, name, kind, file: file.path, line: lineOf(file.content, offset), createdBy: enclosingFunction(file.content, offset), writers: [], readers: [], operations: [] };
    resources.set(key, current); return current;
  };
  for (const file of files.filter(item => /\.(?:c|cc|cpp)$/i.test(item.name))) {
    const content = clean(file.content);
    const create = /\b([A-Za-z_]\w*)\s*=\s*(xQueueCreate|xSemaphoreCreateMutex|xSemaphoreCreateBinary|xEventGroupCreate|xTimerCreate|osMessageQueueNew|osMutexNew|osSemaphoreNew|osEventFlagsNew|osTimerNew|rt_mq_create|rt_mutex_create|rt_sem_create|rt_timer_create)\s*\(/g;
    for (const match of content.matchAll(create)) { const kind = resourceKind(match[2]); if (kind) ensure(match[1], kind, file, match.index ?? 0); }
    const declared = /\b(K_MSGQ_DEFINE|K_MUTEX_DEFINE|K_SEM_DEFINE|K_TIMER_DEFINE)\s*\(\s*([A-Za-z_]\w*)|\b(k_msgq_init|k_mutex_init|k_sem_init|k_timer_init|tx_queue_create|tx_mutex_create|tx_semaphore_create|tx_event_flags_create|tx_timer_create|pthread_mutex_init|sem_init|OSQCreate|OSSemCreate|OSMutexCreate)\s*\(\s*&?([A-Za-z_]\w*)/g;
    for (const match of content.matchAll(declared)) { const api = match[1] || match[3], name = match[2] || match[4], kind = resourceKind(api); if (kind) ensure(name, kind, file, match.index ?? 0); }
    const operation = /\b(xQueueSend|xQueueSendFromISR|xQueueReceive|xSemaphoreTake|xSemaphoreGive|xEventGroupSetBits|xEventGroupWaitBits|xTimerStart|xTimerStop|osMessageQueuePut|osMessageQueueGet|osMutexAcquire|osMutexRelease|osSemaphoreAcquire|osSemaphoreRelease|osEventFlagsSet|osEventFlagsWait|rt_mq_send|rt_mq_recv|rt_mutex_take|rt_mutex_release|rt_sem_take|rt_sem_release|k_msgq_put|k_msgq_get|k_mutex_lock|k_mutex_unlock|k_sem_take|k_sem_give|tx_queue_send|tx_queue_receive|tx_mutex_get|tx_mutex_put|tx_semaphore_get|tx_semaphore_put|pthread_mutex_lock|pthread_mutex_unlock|sem_wait|sem_post|OSQPost|OSQPend|OSSemPost|OSSemPend|OSMutexPend|OSMutexPost)\s*\(\s*&?([A-Za-z_]\w*)/g;
    for (const match of content.matchAll(operation)) {
      const kind = resourceKind(match[1]) ?? (/Mutex/i.test(match[1]) ? 'mutex' : /Sem/i.test(match[1]) ? 'semaphore' : /Event/i.test(match[1]) ? 'event' : 'queue'), item = ensure(match[2], kind, file, match.index ?? 0), owner = enclosingFunction(content, match.index ?? 0), isWrite = /Send|Put|Give|Release|Set|Post|Unlock/i.test(match[1]);
      if (owner) (isWrite ? item.writers : item.readers).push(owner);
      item.operations.push({ operation: match[1], function: owner, file: file.path, line: lineOf(content, match.index ?? 0) });
    }
  }
  return [...resources.values()].map(item => ({ ...item, writers: [...new Set(item.writers)], readers: [...new Set(item.readers)] }));
}

function splitArgs(value: string) {
  const args: string[] = []; let start = 0, depth = 0, quote = '';
  for (let index = 0; index < value.length; index += 1) { const char = value[index]; if (quote) { if (char === quote && value[index - 1] !== '\\') quote = ''; continue; } if (char === '"' || char === "'") { quote = char; continue; } if (char === '(') depth += 1; else if (char === ')') depth -= 1; else if (char === ',' && depth === 0) { args.push(value.slice(start, index).trim()); start = index + 1; } }
  args.push(value.slice(start).trim()); return args;
}

function analyzeTasksAndCallbacks(files: BehaviorFile[]) {
  const tasks: TaskProfile[] = [], callbacks: CallbackRegistration[] = [];
  for (const file of files.filter(item => /\.(?:c|cc|cpp)$/i.test(item.name))) {
    const content = clean(file.content), taskPattern = new RegExp(TASK_API_PATTERN.source, TASK_API_PATTERN.flags);
    for (const match of content.matchAll(taskPattern)) {
      const args = splitArgs(match[2]), mapping = taskSpec(match[1]);
      const entry = mapping && mapping.entry >= 0 ? args[mapping.entry]?.replace(/^&/, '') : undefined, name = mapping?.name === undefined ? entry || match[1] : args[mapping.name]?.replace(/["']/g, '') || entry || match[1];
      tasks.push({ name, api: match[1], file: file.path, line: lineOf(content, match.index ?? 0), entry, stack: mapping?.stack === undefined ? undefined : args[mapping.stack], priority: mapping?.priority === undefined ? undefined : args[mapping.priority] });
    }
    const callbackPattern = /\b((?:HAL_\w+_RegisterCallback|esp_event_handler_register|mqtt_client_register_event|register_\w+_callback|set_\w+_callback))\s*\(([^;]{0,600})\)/gi;
    for (const match of content.matchAll(callbackPattern)) {
      const args = splitArgs(match[2]), callback = [...args].reverse().find(arg => /^&?[A-Za-z_]\w*$/.test(arg));
      if (callback) callbacks.push({ callback: callback.replace(/^&/, ''), source: args[0] ?? 'unknown', api: match[1], file: file.path, line: lineOf(content, match.index ?? 0) });
    }
  }
  return { tasks, callbacks };
}

export function analyzeProgramBehavior(files: BehaviorFile[]): ProgramBehavior {
  const { tasks, callbacks } = analyzeTasksAndCallbacks(files), compileCommands = files.some(file => file.name.toLowerCase() === 'compile_commands.json'), keilProject = files.some(file => /\.uvprojx?$/i.test(file.name)), iarProject = files.some(file => /\.ewp$/i.test(file.name));
  const evidence = [compileCommands && '发现 compile_commands.json，可用于精确语义分析', keilProject && '发现 Keil 工程配置', iarProject && '发现 IAR 工程配置'].filter(Boolean) as string[];
  return { stateMachines: analyzeStateMachines(files), resources: analyzeResources(files), tasks, callbacks, metadata: { compileCommands, keilProject, iarProject, confidence: compileCommands ? 'high' : keilProject || iarProject ? 'medium' : 'low', evidence: evidence.length ? evidence : ['当前使用通用源码规则；未发现可复用的编译数据库'] } };
}
