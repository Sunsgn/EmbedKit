import type { Tutorial } from '../types';

export const tutorials: Tutorial[] = [
  {
    id: 'blink-led',
    title: 'LED 闪烁 - 嵌入式 Hello World',
    category: '基础入门',
    difficulty: 'beginner',
    content: `
# LED 闪烁

嵌入式开发的第一步永远是让 LED 闪烁。本教程将以 STM32F103 为例，演示如何使用 HAL 库控制 GPIO。

## 原理

通过配置 GPIO 为输出模式，然后交替设置高低电平，配合延时函数实现闪烁效果。

## 硬件准备

- STM32F103C8T6 开发板
- LED x1
- 电阻 220Ω x1
- 杜邦线

## 接线

LED 正极 → PA5 → STM32
LED 负极 → GND
    `,
    codeExample: `#include "stm32f1xx_hal.h"

void SystemClock_Config(void);
static void MX_GPIO_Init(void);

int main(void) {
    HAL_Init();
    SystemClock_Config();
    MX_GPIO_Init();

    while (1) {
        HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5);
        HAL_Delay(500);
    }
}

static void MX_GPIO_Init(void) {
    GPIO_InitTypeDef GPIO_InitStruct = {0};

    __HAL_RCC_GPIOA_CLK_ENABLE();

    GPIO_InitStruct.Pin = GPIO_PIN_5;
    GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;
    GPIO_InitStruct.Pull = GPIO_NOPULL;
    GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;
    HAL_GPIO_Init(GPIOA, &GPIO_InitStruct);
}
`,
  },
  {
    id: 'uart-communication',
    title: 'UART 串口通信',
    category: '通信协议',
    difficulty: 'beginner',
    content: `
# UART 串口通信

UART 是最常用的串行通信接口，用于调试输出和设备间通信。

## 关键配置

- 波特率：9600 / 115200
- 数据位：8
- 停止位：1
- 校验位：无
    `,
    codeExample: `#include "stm32f1xx_hal.h"

UART_HandleTypeDef huart1;

static void MX_USART1_UART_Init(void) {
    huart1.Instance = USART1;
    huart1.Init.BaudRate = 115200;
    huart1.Init.WordLength = UART_WORDLENGTH_8B;
    huart1.Init.StopBits = UART_STOPBITS_1;
    huart1.Init.Parity = UART_PARITY_NONE;
    huart1.Init.Mode = UART_MODE_TX_RX;
    HAL_UART_Init(&huart1);
}

void sendString(const char* str) {
    HAL_UART_Transmit(&huart1, (uint8_t*)str, strlen(str), HAL_MAX_DELAY);
}
`,
  },
  {
    id: 'i2c-sensor',
    title: 'I2C 读取传感器数据',
    category: '通信协议',
    difficulty: 'intermediate',
    content: `
# I2C 总线与传感器

I2C 是嵌入式系统中最常用的总线协议之一，用于连接各类传感器。
    `,
    codeExample: `// I2C read example
uint8_t buffer[6];
HAL_I2C_Mem_Read(&hi2c1, 0x68, 0x32, 1, buffer, 6, 100);
int16_t x = (int16_t)(buffer[0] | (buffer[1] << 8));
`,
  },
  {
    id: 'freertos-basic',
    title: 'FreeRTOS 多任务基础',
    category: '实时操作系统',
    difficulty: 'intermediate',
    content: `
# FreeRTOS 入门

学习如何在嵌入式系统中使用 RTOS 实现多任务并行处理。

## 核心概念

- **任务 (Task)**: 独立的执行流，拥有自己的栈空间
- **队列 (Queue)**: 任务间安全传递数据的 FIFO 缓冲
- **信号量 (Semaphore)**: 用于同步和互斥控制的计数器
- **互斥量 (Mutex)**: 带优先级继承机制的二值信号量
- **定时器 (Timer)**: 延迟执行或周期性执行回调函数

## 任务优先级

FreeRTOS 使用抢占式调度，高优先级任务总是优先运行。合理设置优先级至关重要：
- 避免优先级翻转（使用 Mutex 而非 Semaphore）
- 不要将所有任务设为同一优先级
- 空闲任务 (IDLE) 优先级永远最低

## 内存配置

在 FreeRTOSConfig.h 中配置：
- configTOTAL_HEAP_SIZE: 堆总大小
- configMINIMAL_STACK_SIZE: 最小栈深
- configMAX_PRIORITIES: 最大优先级数

## 常见陷阱

1. **栈溢出**: 使用 uxTaskGetStackHighWaterMark() 监控
2. **死锁**: 按固定顺序获取多个 Mutex
3. **优先级反转**: 始终使用 Mutex 保护共享资源
    `,
    codeExample: `#include "FreeRTOS.h"
#include "task.h"
#include "queue.h"
#include "semphr.h"

/* 任务句柄 */
static TaskHandle_t xLEDTask = NULL;
static TaskHandle_t xUARTTask = NULL;

/* 队列和互斥量 */
static QueueHandle_t xDataQueue;
static SemaphoreHandle_t xUARTMutex;

/* LED 闪烁任务 - 低优先级 */
static void LED_Task(void *pvParameters) {
    (void) pvParameters;
    while (1) {
        HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5);
        vTaskDelay(pdMS_TO_TICKS(500));
    }
}

/* UART 数据处理任务 - 高优先级 */
static void UART_Task(void *pvParameters) {
    uint8_t rxData;
    (void) pvParameters;
    while (1) {
        /* 阻塞等待队列数据 */
        if (xQueueReceive(xDataQueue, &rxData, portMAX_DELAY) == pdPASS) {
            /* 互斥保护 UART 发送 */
            if (xSemaphoreTake(xUARTMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
                HAL_UART_Transmit(&huart1, &rxData, 1, 100);
                xSemaphoreGive(xUARTMutex);
            }
        }
    }
}

/* 初始化并启动任务 */
void StartFreeRTOS(void) {
    xDataQueue = xQueueCreate(128, sizeof(uint8_t));
    xUARTMutex = xSemaphoreCreateMutex();

    xTaskCreate(LED_Task, "LED", configMINIMAL_STACK_SIZE * 2,
                NULL, tskIDLE_PRIORITY + 1, &xLEDTask);
    xTaskCreate(UART_Task, "UART", configMINIMAL_STACK_SIZE * 4,
                NULL, tskIDLE_PRIORITY + 2, &xUARTTask);

    vTaskStartScheduler();
    while (1); /* Should never reach here */
}
`,
  },
{
    id: 'dma-transfer',
    title: 'DMA 数据传输',
    category: '外设驱动',
    difficulty: 'intermediate',
    content: `
# DMA 深入讲解

掌握直接存储器访问(DMA)技术，实现高效数据搬运而不占用 CPU。

## DMA 工作原理

DMA 控制器允许外设和存储器之间直接进行数据传输，无需 CPU 干预：
- **外设到内存 (P2M)**: ADC 采样、UART 接收
- **内存到外设 (M2P)**: DAC 输出、UART 发送、SPI 发送
- **内存到内存 (M2M)**: 数据缓冲区拷贝

## 关键配置参数

| 参数 | 说明 | 常见值 |
|------|------|--------|
| 传输方向 | DMA_PeriphToMemory / DMA_MemoryToPeriph | 根据外设决定 |
| 数据宽度 | 字节/半字/字 | 匹配外设数据寄存器宽度 |
| 循环模式 | 启用后传输完成自动重载 | ADC/DAC 常用 |
| 优先级 | 低/中/高/很高 | 多通道竞争时使用 |

## DMA 完成通知

DMA 传输完成可通过两种方式通知：
1. **中断**: 触发 DMA 中断服务程序
2. **HAL 回调**: 使用 HAL 库时重写 xx_CpltCallback 函数

## 最佳实践

- 使用 __attribute__((aligned(4))) 确保内存对齐
- 大尺寸传输时开启 DMA 中断而非轮询标志位
- 循环模式下注意缓冲区不要越界写入
    `,
    codeExample: `#include "stm32f4xx_hal.h"

DMA_HandleTypeDef hdma_uart_tx;
DMA_HandleTypeDef hdma_adc;

uint8_t txBuffer[256] __attribute__((aligned(4)));
uint16_t adcBuffer[128] __attribute__((aligned(4)));

/* UART DMA 发送初始化 */
void MX_DMA_UART_Init(void) {
    __HAL_LINKDMA(&huart1, hdmatx, hdma_uart_tx);

    hdma_uart_tx.Instance = DMA1_Stream7;
    hdma_uart_tx.Init.Direction = DMA_MEMORY_TO_PERIPH;
    hdma_uart_tx.Init.PeriphInc = DMA_PINC_DISABLE;
    hdma_uart_tx.Init.MemInc = DMA_MINC_ENABLE;
    hdma_uart_tx.Init.PeriphDataAlignment = DMA_PDATAALIGN_BYTE;
    hdma_uart_tx.Init.MemDataAlignment = DMA_MDATAALIGN_BYTE;
    hdma_uart_tx.Init.Mode = DMA_NORMAL;
    hdma_uart_tx.Init.Priority = DMA_PRIORITY_HIGH;

    HAL_DMA_Init(&hdma_uart_tx);
    HAL_NVIC_SetPriority(DMA1_Stream7_IRQn, 1, 0);
    HAL_NVIC_EnableIRQ(DMA1_Stream7_IRQn);
}

/* ADC DMA 循环采集初始化 */
void MX_DMA_ADC_Init(void) {
    __HAL_LINKDMA(&hadc1, DMA_Handle, hdma_adc);

    hdma_adc.Instance = DMA2_Stream0;
    hdma_adc.Init.Direction = DMA_PERIPH_TO_MEMORY;
    hdma_adc.Init.PeriphInc = DMA_PINC_DISABLE;
    hdma_adc.Init.MemInc = DMA_MINC_ENABLE;
    hdma_adc.Init.PeriphDataAlignment = DMA_PDATAALIGN_HALFWORD;
    hdma_adc.Init.MemDataAlignment = DMA_MDATAALIGN_HALFWORD;
    hdma_adc.Init.Mode = DMA_CIRCULAR;  /* 循环模式 */
    hdma_adc.Init.Priority = DMA_PRIORITY_VERY_HIGH;

    HAL_DMA_Init(&hdma_adc);
}

/* 发送数据 */
void SendDataDMA(uint8_t* data, uint16_t len) {
    HAL_UART_Transmit_DMA(&huart1, data, len);
}

/* DMA 传输完成回调 */
void HAL_UART_TxCpltCallback(UART_HandleTypeDef *huart) {
    if (huart->Instance == USART1) {
        /* 传输完成标志 */
    }
}
`,
  },
];

export function getTutorialsByCategory(category: string): Tutorial[] {
  return tutorials.filter((t) => t.category === category);
}

export const categories = [...new Set(tutorials.map((t) => t.category))];
