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
    `,
  },
  {
    id: 'dma-transfer',
    title: 'DMA 数据传输',
    category: '进阶技术',
    difficulty: 'advanced',
    content: `
# DMA 直接内存访问

DMA 允许外设与内存之间直接传输数据，无需 CPU 干预。
    `,
  },
];

export function getTutorialsByCategory(category: string): Tutorial[] {
  return tutorials.filter((t) => t.category === category);
}

export const categories = [...new Set(tutorials.map((t) => t.category))];
