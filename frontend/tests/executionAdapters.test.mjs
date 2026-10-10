import assert from 'node:assert/strict';
import test from 'node:test';
import { detectExecutionModel } from '../src/utils/executionAdapters.ts';

test('detects multiple execution models without assuming FreeRTOS', () => {
  const cases = [
    ['int main(void) { while (1) { logic_process(); } }', 'bare-metal'],
    ['void app_main(void) {}\nidf_component_register(SRCS "main.c")', 'esp-idf'],
    ['int main(void) { rt_thread_create("net", net_entry, 0, 1024, 10, 5); }', 'rt-thread'],
    ['K_THREAD_DEFINE(worker, 1024, worker_entry, 0, 0, 0, 5, 0, 0);', 'zephyr'],
    ['int main(void) { tx_kernel_enter(); }', 'threadx'],
    ['int main(void) { OSTaskCreate(AppTask, 0, stack, 5); OSStart(); }', 'ucos'],
    ['pthread_create(&thread, 0, worker, 0);', 'posix'],
    ['LOS_KernelInit(); LOS_TaskCreate(&id, &init);', 'liteos'],
    ['void setup(void) { board_init(); } void loop(void) { poll(); }', 'arduino'],
    ['int main(void) { for (;;) { logic_process(); } }', 'bare-metal'],
    ['void init(void) { register_rx_callback(on_rx); }', 'event-driven'],
  ];
  for (const [source, expected] of cases) assert.equal(detectExecutionModel(source).id, expected);
});
