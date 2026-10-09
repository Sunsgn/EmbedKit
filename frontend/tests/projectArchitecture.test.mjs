import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeProjectArchitecture } from '../src/utils/projectArchitecture.ts';

test('recovers bare-metal entry, initialization chain and interrupts', () => {
  const files = [{ name: 'main.c', path: '/Core/Src/main.c', content: `
static void MX_GPIO_Init(void) { HAL_GPIO_Init(); }
void USART1_IRQHandler(void) { uart_rx_callback(); }
int main(void) {
  HAL_Init();
  SystemClock_Config();
  MX_GPIO_Init();
  while (1) { app_process(); }
}` }];
  const result = analyzeProjectArchitecture(files);
  assert.equal(result.runtime, '裸机主循环');
  assert.equal(result.entries[0].name, 'main');
  assert.equal(result.initChain.some(item => item.name === 'MX_GPIO_Init'), true);
  assert.equal(result.interrupts.some(item => item.name === 'USART1_IRQHandler'), true);
  const startup = result.flows.find(item => item.context === 'startup');
  assert.deepEqual(startup.steps.filter(item => ['MX_GPIO_Init', 'app_process'].includes(item.name)).map(item => item.name), ['MX_GPIO_Init', 'app_process']);
  assert.equal(startup.steps.find(item => item.name === 'app_process')?.control, 'loop');
  assert.equal(result.flows.some(item => item.context === 'interrupt'), true);
});

test('recovers FreeRTOS task creation and static call edges', () => {
  const files = [
    { name: 'main.c', path: '/app/main.c', content: `
static void SensorTask(void *arg) { methane_poll(); }
int main(void) {
  board_init();
  xTaskCreate(SensorTask, "sensor", 512, 0, 3, 0);
  vTaskStartScheduler();
}` },
    { name: 'methane.c', path: '/drivers/methane.c', content: 'void methane_poll(void) { HAL_UART_Receive(); }' },
  ];
  const result = analyzeProjectArchitecture(files);
  assert.equal(result.runtime, 'FreeRTOS');
  assert.equal(result.tasks.some(item => item.name === 'SensorTask'), true);
  assert.equal(result.edges.some(item => item.type === 'creates'), true);
  assert.equal(result.layers.some(item => item.id === 'driver'), true);
  const startup = result.flows.find(item => item.context === 'startup');
  assert.equal(startup.steps.some(item => item.relation === 'create' && item.name === '创建任务 SensorTask'), true);
  const task = result.flows.find(item => item.context === 'task');
  assert.equal(task.steps.some(item => item.name === 'methane_poll'), true);
  assert.match(task.notes.join(' '), /并发执行/);
});

test('keeps conditional branches and recursive cycles explicit', () => {
  const files = [{ name: 'app.c', path: '/app.c', content: `
void retry(void) { retry(); }
void service(void) { if (network_ready()) { retry(); } }
int main(void) { service(); }
` }];
  const result = analyzeProjectArchitecture(files);
  const startup = result.flows.find(item => item.context === 'startup');
  assert.equal(startup.steps.find(item => item.name === 'retry')?.control, 'branch');
  assert.equal(startup.steps.some(item => item.relation === 'cycle'), true);
});
