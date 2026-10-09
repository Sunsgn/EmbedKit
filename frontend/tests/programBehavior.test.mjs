import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeProgramBehavior } from '../src/utils/programBehavior.ts';

test('discovers state transitions with conditions', () => {
  const files = [{ name: 'network.c', path: '/app/network.c', content: `
void network_process(void) {
  switch (net_state) {
    case NET_IDLE:
      if (start_requested()) { net_state = NET_CONNECTING; }
      break;
    case NET_CONNECTING:
      if (socket_ready()) { net_state = NET_ONLINE; }
      else if (timeout()) { net_state = NET_IDLE; }
      break;
    case NET_ONLINE:
      break;
  }
}` }];
  const result = analyzeProgramBehavior(files);
  assert.equal(result.stateMachines.length, 1);
  assert.deepEqual(result.stateMachines[0].states, ['NET_IDLE', 'NET_CONNECTING', 'NET_ONLINE']);
  assert.equal(result.stateMachines[0].transitions.some(item => item.from === 'NET_IDLE' && item.to === 'NET_CONNECTING'), true);
});

test('discovers RTOS task parameters and shared resources', () => {
  const files = [{ name: 'main.c', path: '/main.c', content: `
void start(void) {
  rx_queue = xQueueCreate(8, sizeof(Packet));
  bus_lock = xSemaphoreCreateMutex();
  xTaskCreate(NetworkTask, "network", 1024, 0, 4, 0);
}
void producer(void) { xQueueSend(rx_queue, &packet, 0); }
void consumer(void) { xQueueReceive(rx_queue, &packet, 10); xSemaphoreTake(bus_lock, 10); }
` }];
  const result = analyzeProgramBehavior(files);
  assert.equal(result.tasks[0].entry, 'NetworkTask');
  assert.equal(result.tasks[0].stack, '1024');
  const queue = result.resources.find(item => item.name === 'rx_queue');
  assert.deepEqual(queue.writers, ['producer']);
  assert.deepEqual(queue.readers, ['consumer']);
  assert.equal(result.resources.some(item => item.name === 'bus_lock' && item.kind === 'mutex'), true);
});

test('uses non-FreeRTOS task and synchronization adapters', () => {
  const files = [{ name: 'os.c', path: '/os.c', content: `
void init(void) {
  OSTaskCreate(ControlTask, 0, control_stack, 7);
  pthread_create(&host_thread, 0, HostWorker, 0);
  k_mutex_init(&bus_mutex);
}
void lock_bus(void) { k_mutex_lock(&bus_mutex, 100); }
void unlock_bus(void) { k_mutex_unlock(&bus_mutex); }
` }];
  const result = analyzeProgramBehavior(files);
  assert.equal(result.tasks.some(item => item.entry === 'ControlTask' && item.priority === '7'), true);
  assert.equal(result.tasks.some(item => item.entry === 'HostWorker'), true);
  assert.equal(result.resources.some(item => item.name === 'bus_mutex' && item.kind === 'mutex'), true);
});
