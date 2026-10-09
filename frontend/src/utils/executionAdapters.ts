export type ExecutionFamily = 'bare-metal' | 'rtos' | 'posix' | 'event-driven' | 'unknown';
export interface ExecutionModel { id: string; label: string; family: ExecutionFamily; confidence: 'high' | 'medium' | 'low'; evidence: string[] }
export interface TaskApiSpec { api: RegExp; entry: number; name?: number; stack?: number; priority?: number }

interface ExecutionAdapter { id: string; label: string; family: ExecutionFamily; signals: Array<{ pattern: RegExp; evidence: string; score: number }> }

export const EXECUTION_ADAPTERS: ExecutionAdapter[] = [
  { id: 'esp-idf', label: 'ESP-IDF / FreeRTOS', family: 'rtos', signals: [{ pattern: /\bapp_main\s*\(/, evidence: '发现 app_main', score: 70 }, { pattern: /idf_component_register|ESP-IDF/i, evidence: '发现 ESP-IDF 工程特征', score: 50 }] },
  { id: 'freertos', label: 'FreeRTOS', family: 'rtos', signals: [{ pattern: /FreeRTOS|vTaskStartScheduler/, evidence: '发现 FreeRTOS 调度器', score: 70 }, { pattern: /\bxTaskCreate(?:Static)?\s*\(/, evidence: '发现 FreeRTOS 任务创建', score: 45 }] },
  { id: 'cmsis-rtos', label: 'CMSIS-RTOS', family: 'rtos', signals: [{ pattern: /\bosKernelStart\s*\(/, evidence: '发现 CMSIS-RTOS 内核启动', score: 70 }, { pattern: /\bosThread(?:New|Create)\s*\(/, evidence: '发现 CMSIS-RTOS 线程创建', score: 45 }] },
  { id: 'rt-thread', label: 'RT-Thread', family: 'rtos', signals: [{ pattern: /RT-Thread|rt_system_scheduler_start/i, evidence: '发现 RT-Thread 调度器', score: 70 }, { pattern: /\brt_thread_(?:create|init)\s*\(/, evidence: '发现 RT-Thread 线程创建', score: 45 }] },
  { id: 'zephyr', label: 'Zephyr', family: 'rtos', signals: [{ pattern: /ZEPHYR|SYS_INIT|K_THREAD_DEFINE/, evidence: '发现 Zephyr 系统特征', score: 70 }, { pattern: /\bk_thread_create\s*\(/, evidence: '发现 Zephyr 线程创建', score: 45 }] },
  { id: 'threadx', label: 'Azure RTOS ThreadX', family: 'rtos', signals: [{ pattern: /\btx_kernel_enter\s*\(/, evidence: '发现 ThreadX 内核入口', score: 75 }, { pattern: /\btx_thread_create\s*\(/, evidence: '发现 ThreadX 线程创建', score: 45 }] },
  { id: 'ucos', label: 'μC/OS-II/III', family: 'rtos', signals: [{ pattern: /\bOSStart\s*\(|uC\/OS|UCOS/i, evidence: '发现 μC/OS 内核特征', score: 70 }, { pattern: /\bOSTaskCreate(?:Ext)?\s*\(/, evidence: '发现 μC/OS 任务创建', score: 45 }] },
  { id: 'embos', label: 'SEGGER embOS', family: 'rtos', signals: [{ pattern: /\bOS_Start\s*\(|embOS/i, evidence: '发现 embOS 内核特征', score: 70 }, { pattern: /\bOS_(?:TASK_CreateEx|CreateTask)\s*\(/, evidence: '发现 embOS 任务创建', score: 45 }] },
  { id: 'nuttx', label: 'NuttX', family: 'posix', signals: [{ pattern: /CONFIG_NUTTX|NuttX/i, evidence: '发现 NuttX 配置', score: 70 }, { pattern: /\btask_create\s*\(/, evidence: '发现 NuttX 任务创建', score: 40 }] },
  { id: 'posix', label: 'POSIX / Embedded Linux', family: 'posix', signals: [{ pattern: /\bpthread_create\s*\(/, evidence: '发现 POSIX线程创建', score: 60 }, { pattern: /#include\s*<pthread\.h>/, evidence: '引用 pthread.h', score: 40 }] },
  { id: 'liteos', label: 'Huawei LiteOS / OpenHarmony', family: 'rtos', signals: [{ pattern: /Huawei LiteOS|OpenHarmony|\bLOS_KernelInit\s*\(/i, evidence: '发现 LiteOS/OpenHarmony 内核特征', score: 70 }, { pattern: /\bLOS_TaskCreate\s*\(/, evidence: '发现 LiteOS任务创建', score: 45 }] },
  { id: 'alios', label: 'AliOS Things', family: 'rtos', signals: [{ pattern: /AliOS|\bkrhino_start\s*\(/i, evidence: '发现 AliOS内核特征', score: 70 }, { pattern: /\bkrhino_task_create\s*\(/, evidence: '发现 Rhino任务创建', score: 45 }] },
];

export const TASK_API_SPECS: TaskApiSpec[] = [
  { api: /^xTaskCreate(?:Static)?$/, entry: 0, name: 1, stack: 2, priority: 4 },
  { api: /^osThread(?:New|Create)$/, entry: 0 },
  { api: /^rt_thread_(?:create|init)$/, entry: 1, name: 0, stack: 3, priority: 4 },
  { api: /^k_thread_create$/, entry: 3, stack: 2, priority: 7 },
  { api: /^tx_thread_create$/, entry: 2, name: 1, stack: 5, priority: 6 },
  { api: /^OSTaskCreate(?:Ext)?$/, entry: 0, stack: 2, priority: 3 },
  { api: /^OS_(?:TASK_CreateEx|CreateTask)$/, entry: 3, name: 1, stack: 5, priority: 2 },
  { api: /^pthread_create$/, entry: 2 },
  { api: /^task_create$/, entry: 3, name: 0, stack: 2, priority: 1 },
  { api: /^krhino_task_create$/, entry: 7, name: 1, stack: 6, priority: 3 },
  { api: /^LOS_TaskCreate$/, entry: -1 },
];

export const TASK_API_PATTERN = /\b(xTaskCreateStatic|xTaskCreate|osThreadNew|osThreadCreate|rt_thread_create|rt_thread_init|k_thread_create|tx_thread_create|OSTaskCreateExt|OSTaskCreate|OS_TASK_CreateEx|OS_CreateTask|pthread_create|task_create|krhino_task_create|LOS_TaskCreate)\s*\(([^;]{0,1000})\)/g;

export function taskSpec(api: string) { return TASK_API_SPECS.find(item => item.api.test(api)); }

export function detectExecutionModel(content: string): ExecutionModel {
  const ranked = EXECUTION_ADAPTERS.map(adapter => {
    const matches = adapter.signals.filter(signal => signal.pattern.test(content));
    return { adapter, score: matches.reduce((sum, item) => sum + item.score, 0), evidence: matches.map(item => item.evidence) };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (best) return { id: best.adapter.id, label: best.adapter.label, family: best.adapter.family, confidence: best.score >= 80 ? 'high' : best.score >= 50 ? 'medium' : 'low', evidence: best.evidence };
  if (/\bwhile\s*\(\s*(?:1|true|;;)\s*\)/i.test(content)) return { id: 'bare-metal', label: '裸机主循环', family: 'bare-metal', confidence: 'medium', evidence: ['发现永久主循环'] };
  if (/\b(?:dispatch|event_loop|process_event|state_machine)\s*\(/i.test(content)) return { id: 'event-driven', label: '事件驱动/协作调度', family: 'event-driven', confidence: 'low', evidence: ['发现事件分发特征'] };
  return { id: 'unknown', label: '未确定执行模型', family: 'unknown', confidence: 'low', evidence: ['未命中已注册的执行模型适配器'] };
}
