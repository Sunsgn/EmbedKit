import type { RoadmapPhase } from '../types';

export const roadmapPhases: RoadmapPhase[] = [
  {
    id: 'c-fundamentals',
    title: 'C语言基础',
    icon: 'code',
    color: '#3b82f6',
    description: '掌握C语言核心语法，指针，内存管理，数据结构等嵌入式开发必备基础',
    duration: '2-4周',
    modules: [
      {
        id: 'c-syntax',
        title: 'C语言语法基础',
        description: '变量、数据类型、运算符、控制流、函数、数组和字符串',
        topics: [
          '数据类型与变量声明',
          '运算符与表达式',
          '条件语句(if/switch)',
          '循环语句(for/while/do-while)',
          '函数定义与调用',
          '数组与字符串操作',
          '结构体与联合体',
          '预处理指令',
        ],
        resources: [
          { title: 'C 语言教程', url: 'https://www.runoob.com/cprogramming/c-tutorial.html', lang: 'zh', type: 'doc' },
          { title: 'C Language Tutorial - TutorialsPoint', url: 'https://www.tutorialspoint.com/cprogramming/index.htm', lang: 'en', type: 'doc' },
          { title: 'C语言入门教程 - 黑马程序员', url: 'https://www.bilibili.com/video/BV1et411b7SU', lang: 'zh', type: 'video' },
        ],
      },
      {
        id: 'c-pointers',
        title: '指针与内存管理',
        description: '深入理解指针、动态内存分配、内存布局，这是嵌入式开发的核心',
        topics: [
          '指针基本概念',
          '指针与数组关系',
          '指针运算',
          '函数指针',
          'void指针与泛型',
          'malloc/calloc/realloc/free',
          '栈与堆内存',
          '内存泄漏检测',
        ],
        resources: [
          { title: 'C 指针详解', url: 'https://www.runoob.com/cprogramming/c-pointers.html', lang: 'zh', type: 'doc' },
          { title: 'Pointers in C - GeeksForGeeks', url: 'https://www.geeksforgeeks.org/c-pointers-set-1-introduction-and-declaration/', lang: 'en', type: 'doc' },
          { title: 'C语言指针详解 - 菜鸟教程视频', url: 'https://www.bilibili.com/video/BV1YK411s7eG', lang: 'zh', type: 'video' },
        ],
        codeExample: `#include <stdio.h>
#include <stdlib.h>

// 函数指针示例
typedef int (*compare_func)(const void *, const void *);

int compare_ints(const void *a, const void *b) {
    int arg1 = *(const int *)a;
    int arg2 = *(const int *)b;
    return (arg1 > arg2) - (arg1 < arg2);
}

int main() {
    // 动态内存分配
    int *numbers = (int *)malloc(5 * sizeof(int));
    if (!numbers) return 1;
    
    for (int i = 0; i < 5; i++) {
        numbers[i] = 5 - i;  // {5, 4, 3, 2, 1}
    }
    
    // 使用函数指针排序
    qsort(numbers, 5, sizeof(int), compare_ints);
    
    for (int i = 0; i < 5; i++) {
        printf("%d ", numbers[i]);  // 1 2 3 4 5
    }
    
    free(numbers);  // 释放内存
    return 0;}`,
        codeLang: 'c',
      },
      {
        id: 'c-data-structures',
        title: '数据结构与算法',
        description: '链表、栈、队列、树、排序算法等嵌入式常用数据结构',
        topics: [
          '链表(单向/双向/循环)',
          '栈与队列',
          '二叉树与二叉搜索树',
          '哈希表',
          '排序算法(冒泡/快速/归并)',
          '查找算法(线性/二分)',
          '位运算技巧',
        ],
        resources: [
          { title: 'C 数据结构', url: 'https://www.runoob.com/cplusplus/cpp-data-structures.html', lang: 'zh', type: 'doc' },
          { title: 'Data Structures in C', url: 'https://www.tutorialspoint.com/data_structures_algorithms/index.htm', lang: 'en', type: 'doc' },
          { title: '数据结构-C语言版 - 严蔚敏', url: 'https://www.bilibili.com/video/BV187411d7pg', lang: 'zh', type: 'video' },
        ],
      },
    ],
  },
  {
    id: 'electronics-basics',
    title: '电子电路基础',
    icon: 'zap',
    color: '#f59e0b',
    description: '学习模拟电路和数字电路基础，看懂原理图，熟练使用万用表和示波器',
    duration: '2-3周',
    modules: [
      {
        id: 'analog-circuits',
        title: '模拟电路基础',
        description: '欧姆定律、基尔霍夫定律、二极管、三极管、运放、滤波电路',
        topics: [
          '电压、电流、电阻与欧姆定律',
          '基尔霍夫电压/电流定律(KVL/KCL)',
          '电容与电感特性',
          '二极管应用(整流/稳压)',
          '三极管放大与开关电路',
          '运算放大器基础',
          '有源/无源滤波器',
          'ADC/DAC基本原理',
        ],
        resources: [
          { title: '模拟电子技术 - 清华大学', url: 'https://www.bilibili.com/video/BV131411L7Ry', lang: 'zh', type: 'video' },
          { title: 'Basic Electronics - AllAboutCircuits', url: 'https://www.allaboutcircuits.com/textbook/', lang: 'en', type: 'doc' },
          { title: '电子技术基础(模拟部分) - 康华光', url: 'https://www.bilibili.com/video/BV1Yh411o7Qe', lang: 'zh', type: 'video' },
        ],
      },
      {
        id: 'digital-circuits',
        title: '数字电路基础',
        description: '逻辑门、组合逻辑、时序逻辑、触发器、状态机、存储器',
        topics: [
          '布尔代数与逻辑门',
          '组合逻辑电路(编码器/译码器/多路选择器)',
          '触发器(D/JK/T/RS)',
          '计数器与寄存器',
          '有限状态机(FSM)',
          'ROM/RAM/Flash存储器',
          '数字噪声与去耦',
        ],
        resources: [
          { title: '数字电子技术基础 - 清华大学', url: 'https://www.bilibili.com/video/BV1q4411H7Kx', lang: 'zh', type: 'video' },
          { title: 'Digital Logic - Neso Academy', url: 'https://www.youtube.com/playlist?list=PLBlnw6jnJQGZ37Gf9LWyGue-efNfMjHH_', lang: 'en', type: 'video' },
        ],
      },
      {
        id: 'schematic-reading',
        title: '原理图与PCB基础',
        description: '学会阅读原理图，了解PCB设计流程，掌握基本焊接技能',
        topics: [
          '原理图符号识别',
          '网络标号与电气连接',
          'PCB分层设计原理',
          '走线与过孔设计',
          '去耦电容放置原则',
          '焊接基础(有铅/无铅)',
          '常用工具使用(万用表/示波器/逻辑分析仪)',
        ],
        resources: [
          { title: 'Altium Designer教程', url: 'https://www.bilibili.com/video/BV1bQ4y1n7jY', lang: 'zh', type: 'video' },
          { title: 'KiCad PCB Design - Phil\'s Lab', url: 'https://www.youtube.com/c/PhilseLab', lang: 'en', type: 'video' },
        ],
      },
    ],
  },
  {
    id: 'stm32-development',
    title: 'STM32开发',
    icon: 'cpu',
    color: '#10b981',
    description: '从寄存器级别到HAL库，系统学习STM32外设驱动开发',
    duration: '4-6周',
    modules: [
      {
        id: 'stm32-architecture',
        title: 'STM32架构与启动流程',
        description: 'Cortex-M内核架构、存储映射、时钟系统、启动流程',
        topics: [
          'ARM Cortex-M3/M4/M7架构',
          '哈佛架构与总线矩阵',
          '存储器映射与内存分区',
          'RCC时钟树配置',
          '启动流程(Bootloader)',
          '向量表与异常处理',
          'NVIC中断控制器',
        ],
        resources: [
          { title: 'STM32参考手册(RM)', url: 'https://www.st.com/resource/en/reference_manual/rm0008-stm32f101xx-stm32f102xx-stm32f103xx-advanced-armbased-32bit-mcus-stmicroelectronics.pdf', lang: 'en', type: 'doc' },
          { title: 'STM32 HAL库文档', url: 'https://docs.st.com/stm32cube/DM00084071', lang: 'en', type: 'doc' },
          { title: 'STM32入门教程 - 正点原子', url: 'https://www.bilibili.com/video/BV1KJ411d7Pb', lang: 'zh', type: 'video' },
          { title: 'STM32 HAL库开发详解', url: 'https://www.bilibili.com/video/BV15K411N7CF', lang: 'zh', type: 'video' },
        ],
      },
      {
        id: 'stm32-gpio-uart',
        title: 'GPIO与UART通信',
        description: '掌握GPIO配置、外部中断、UART串口通信',
        topics: [
          'GPIO模式配置(输入/输出/复用/模拟)',
          '输出类型(推挽/开漏)',
          '外部中断(EXTI)配置',
          'UART/USART基本原理',
          'UART轮询与中断收发',
          'DMA+UART传输',
          '串口调试技巧',
        ],
        resources: [
          { title: 'STM32 GPIO教程 - 野火', url: 'https://www.firebbs.cn/forum.php', lang: 'zh', type: 'doc' },
          { title: 'STM32 UART通信详解', url: 'https://www.bilibili.com/video/BV1Xh411o7Ym', lang: 'zh', type: 'video' },
        ],
        codeExample: `#include "stm32f1xx_hal.h"

UART_HandleTypeDef huart2;

void MX_USART2_UART_Init(void) {
    huart2.Instance = USART2;
    huart2.Init.BaudRate = 115200;
    huart2.Init.WordLength = UART_WORDLENGTH_8B;
    huart2.Init.StopBits = UART_STOPBITS_1;
    huart2.Init.Parity = UART_PARITY_NONE;
    huart2.Init.Mode = UART_MODE_TX_RX;
    huart2.Init.HwFlowCtl = UART_HWCONTROL_NONE;
    HAL_UART_Init(&huart2);
}

void HAL_UART_MspInit(UART_HandleTypeDef *huart) {
    if (huart->Instance == USART2) {
        __HAL_RCC_GPIOA_CLK_ENABLE();
        __HAL_RCC_USART2_CLK_ENABLE();
        
        GPIO_InitTypeDef GPIO_InitStruct = {0};
        GPIO_InitStruct.Pin = GPIO_PIN_2 | GPIO_PIN_3;
        GPIO_InitStruct.Mode = GPIO_MODE_AF_PP;
        GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_HIGH;
        HAL_GPIO_Init(GPIOA, &GPIO_InitStruct);
    }
}

// 中断方式接收
void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart) {
    if (huart->Instance == USART2) {
        // 处理接收到的数据
        uint8_t received = huart->pRxBuffPtr[0];
        HAL_UART_Transmit(&huart2, &received, 1, 100);
        HAL_UART_Receive_IT(&huart2, huart->pRxBuffPtr, 1);
    }
}`,
        codeLang: 'c',
      },
      {
        id: 'stm32-timer-pwm',
        title: '定时器与PWM',
        description: '通用定时器、输入捕获、PWM输出、RTC实时时钟',
        topics: [
          '定时器基本原理(预分频/重装载)',
          '基本定时器定时功能',
          '输入捕获模式',
          '输出比较模式',
          'PWM生成与配置',
          '互补PWM输出',
          'RTC实时时钟配置',
          'SysTick滴答定时器',
        ],
        resources: [
          { title: 'STM32定时器详解 - 正点原子', url: 'https://www.bilibili.com/video/BV1pj411x7bG', lang: 'zh', type: 'video' },
          { title: 'STM32 PWM输出教程', url: 'https://www.bilibili.com/video/BV1Yh411o7Ym', lang: 'zh', type: 'video' },
        ],
      },
      {
        id: 'stm32-adc-dac',
        title: 'ADC/DAC与DAC',
        description: '模数转换、数模转换、DMA传输、多通道采样',
        topics: [
          'ADC基本原理与分辨率',
          'ADC单通道/多通道采集',
          'ADC+DMA连续采样',
          'ADC注入模式',
          'DAC基本原理',
          'DAC波形生成',
        ],
        resources: [
          { title: 'STM32 ADC教程', url: 'https://www.bilibili.com/video/BV1qJ411d7Pb', lang: 'zh', type: 'video' },
        ],
      },
      {
        id: 'stm32-i2c-spi',
        title: 'I2C与SPI总线',
        description: '掌握I2C和SPI通信协议，驱动OLED、EEPROM、传感器等设备',
        topics: [
          'I2C协议时序(起始/停止/ACK/NACK)',
          'I2C HAL库与LL库驱动',
          'I2C驱动OLED屏幕(SSD1306)',
          'I2C驱动AT24C02 EEPROM',
          'SPI协议时序与模式',
          'SPI全双工通信',
          'SPI驱动SD卡/W25Qxx Flash',
        ],
        resources: [
          { title: 'I2C协议详解', url: 'https://www.bilibili.com/video/BV1Xh411o7Ym', lang: 'zh', type: 'video' },
          { title: 'SPI协议详解', url: 'https://www.bilibili.com/video/BV1q4411H7Kx', lang: 'zh', type: 'video' },
        ],
      },
    ],
  },
  {
    id: 'esp32-development',
    title: 'ESP32物联网开发',
    icon: 'wifi',
    color: '#8b5cf6',
    description: '学习ESP32双核架构、WiFi/BLE通信、OTA升级和物联网协议',
    duration: '3-4周',
    modules: [
      {
        id: 'esp32-basics',
        title: 'ESP32基础与FreeRTOS',
        description: 'ESP32硬件架构、Arduino/ESP-IDF开发环境、FreeRTOS任务管理',
        topics: [
          'ESP32芯片型号与引脚定义',
          'ESP32双核架构与内存',
          'Arduino框架快速入门',
          'ESP-IDF开发环境搭建',
          'FreeRTOS任务创建与调度',
          '信号量/互斥量/队列',
          '任务间通信机制',
        ],
        resources: [
          { title: 'ESP-IDF官方文档', url: 'https://docs.espressif.com/projects/esp-idf/zh_CN/latest/esp32/', lang: 'zh', type: 'doc' },
          { title: 'ESP32 Technical Reference Manual', url: 'https://www.espressif.com.cn/sites/default/files/documentation/esp32_technical_reference_manual_cn.pdf', lang: 'zh', type: 'doc' },
          { title: 'ESP32开发教程 - 乐鑫官方', url: 'https://www.bilibili.com/video/BV1pP411W7Jy', lang: 'zh', type: 'video' },
        ],
        codeExample: `#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>

#define LED_PIN 2

const char* ssid = "YourWiFi";
const char* password = "YourPassword";

WebServer server(80);

void handleRoot() {
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    server.send(200, "text/plain", 
        "LED toggled! State: " + String(digitalRead(LED_PIN)));
}

void handleNotFound() {
    server.send(404, "text/plain", "Not found");
}

void setup() {
    pinMode(LED_PIN, OUTPUT);
    Serial.begin(115200);
    
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\\nConnected! IP: " + WiFi.localIP().toString());
    
    server.on("/", handleRoot);
    server.onNotFound(handleNotFound);
    server.begin();
}

void loop() {
    server.handleClient();
}`,
        codeLang: 'cpp',
      },
      {
        id: 'esp32-wifi-mqtt',
        title: 'WiFi与MQTT通信',
        description: 'TCP/UDP socket编程、HTTP请求、MQTT协议与云平台对接',
        topics: [
          'STA/AP模式配置',
          'TCP Client/Server编程',
          'HTTP GET/POST请求',
          'HTTPS与证书验证',
          'MQTT协议原理(PUBLISH/SUBSCRIBE)',
          'MQTT连接阿里云IoT平台',
          'MQTT连接EMQX服务器',
          'MQTT QoS与Retain消息',
        ],
        resources: [
          { title: 'MQTT协议入门', url: 'https://www.runoob.com/w3cnote/mqtt.html', lang: 'zh', type: 'doc' },
          { title: 'MQTT Essentials - HiveMQ', url: 'https://www.hivemq.com/blog/mqtt-essentials-part-1-introduction-to-mqtt/', lang: 'en', type: 'doc' },
          { title: 'ESP32 MQTT教程', url: 'https://randomnerdtutorials.com/esp32-mqtt-publish-subscribe-arduino-ide/', lang: 'en', type: 'doc' },
        ],
      },
      {
        id: 'esp32-ble-ota',
        title: 'BLE与OTA升级',
        description: '蓝牙低功耗通信、GATT服务、固件OTA远程升级',
        topics: [
          'BLE广播与连接',
          'GATT服务与特征值',
          'BLE Server/Client角色',
          'NVS非易失性存储',
          'Deep-sleep低功耗模式',
          'OTA固件升级原理',
          'Arduino OTA实现',
          'ESP-IDF OTA实现',
        ],
        resources: [
          { title: 'ESP32 BLE教程', url: 'https://randomnerdtutorials.com/esp32-bluetooth-low-energy-ble-arduino/', lang: 'en', type: 'doc' },
          { title: 'ESP32 OTA升级 - 乐鑫文档', url: 'https://docs.espressif.com/projects/esp-idf/zh_CN/latest/esp32/api-reference/system/ota.html', lang: 'zh', type: 'doc' },
        ],
      },
    ],
  },
  {
    id: 'protocols',
    title: '通信协议深入',
    icon: 'network',
    color: '#06b6d4',
    description: '深入理解UART、I2C、SPI、CAN、RS485、Modbus等工业常用协议',
    duration: '2-3周',
    modules: [
      {
        id: 'serial-protocols',
        title: '串行通信协议',
        description: 'UART、I2C、SPI协议的电气特性和时序分析',
        topics: [
          'UART异步通信原理',
          'UART多机通信与LIN总线',
          'I2C总线仲裁与多主模式',
          'I2C七位/十位地址模式',
          'SPI四种工作模式',
          'SPI Daisy-chain与多从机',
          '协议对比与选型指南',
        ],
        resources: [
          { title: 'I2C协议详解 - NXP应用笔记', url: 'https://www.nxp.com/docs/en/application-note/AN10243.pdf', lang: 'en', type: 'doc' },
          { title: 'SPI vs I2C vs UART', url: 'https://www.circuitbasics.com/breaking-down-serial-communication-i2c-spi-uart/', lang: 'en', type: 'doc' },
        ],
      },
      {
        id: 'industrial-protocols',
        title: '工业通信协议',
        description: 'CAN总线、RS485、Modbus RTU/TCP工业标准协议',
        topics: [
          'CAN总线物理层与数据链路层',
          'CAN帧格式(标准/扩展)',
          'CAN总线仲裁与位定时',
          'RS485半双工通信',
          'Modbus RTU协议帧格式',
          'Modbus TCP协议',
          'Modbus寄存器映射',
        ],
        resources: [
          { title: 'CAN总线协议详解', url: 'https://www.bilibili.com/video/BV1qY411d7XB', lang: 'zh', type: 'video' },
          { title: 'Modbus协议入门', url: 'https://www.modbus.org/docs/modbus-mec-161-revmp.pdf', lang: 'en', type: 'doc' },
        ],
      },
    ],
  },
  {
    id: 'rtos',
    title: 'RTOS实时操作系统',
    icon: 'layers',
    color: '#ef4444',
    description: '从FreeRTOS到RT-Thread，掌握嵌入式实时操作系统核心概念',
    duration: '3-4周',
    modules: [
      {
        id: 'rtos-concepts',
        title: 'RTOS核心概念',
        description: '任务调度、优先级继承、上下文切换、内存管理',
        topics: [
          '裸机编程 vs RTOS',
          '前后台系统与抢占式调度',
          '任务状态(就绪/运行/阻塞/挂起)',
          '上下文切换原理',
          '优先级调度策略',
          '时间片轮转调度',
          '优先级继承与天花板',
        ],
        resources: [
          { title: 'FreeRTOS官方文档', url: 'https://www.freertos.org/Documentation/FAQ-FREERTOS-CORE', lang: 'en', type: 'doc' },
          { title: 'FreeRTOS中文教程', url: 'https://www.cnblogs.com/bianmaze/p/13648278.html', lang: 'zh', type: 'doc' },
          { title: 'FreeRTOS入门教程 - 正点原子', url: 'https://www.bilibili.com/video/BV1bQ4y1n7jY', lang: 'zh', type: 'video' },
        ],
        codeExample: `#include "FreeRTOS.h"
#include "task.h"
#include "queue.h"
#include "semphr.h"

// 任务句柄
TaskHandle_t xLEDTask = NULL;
TaskHandle_t xSensorTask = NULL;

// 消息队列
QueueHandle_t xSensorQueue;
SemaphoreHandle_t xMutex;

// LED闪烁任务 (低优先级)
void vLEDTask(void *pvParameters) {
    for (;;) {
        digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
        vTaskDelay(pdMS_TO_TICKS(500));
    }
}

// 传感器采集任务 (高优先级)
void vSensorTask(void *pvParameters) {
    int sensorValue = 0;
    for (;;) {
        sensorValue = analogRead(A0);
        
        // 使用互斥锁保护共享资源
        if (xSemaphoreTake(xMutex, portMAX_DELAY) == pdTRUE) {
            xQueueSend(xSensorQueue, &sensorValue, 0);
            xSemaphoreGive(xMutex);
        }
        
        vTaskDelay(pdMS_TO_TICKS(1000));
    }
}

void setup() {
    xSensorQueue = xQueueCreate(10, sizeof(int));
    xMutex = xSemaphoreCreateMutex();
    
    xTaskCreate(vLEDTask, "LED", 128, NULL, 1, &xLEDTask);
    xTaskCreate(vSensorTask, "Sensor", 256, NULL, 2, &xSensorTask);
    vTaskStartScheduler();
}`,
        codeLang: 'cpp',
      },
      {
        id: 'rt-thread',
        title: 'RT-Thread深入学习',
        description: 'RT-Thread内核组件、设备框架、FinSH命令行、软件包管理',
        topics: [
          'RT-Thread架构与内核对象',
          '设备驱动框架(IO Manager)',
          'FinSH命令行使用',
          'msh命令行扩展',
          'Software Package管理',
          'RT-Thread Studio使用',
          '组件: LWIP/MQTT/DFS',
        ],
        resources: [
          { title: 'RT-Thread官方文档', url: 'https://www.rt-thread.org/document/site/', lang: 'zh', type: 'doc' },
          { title: 'RT-Thread入门手册', url: 'https://www.bilibili.com/video/BV14K411N7CF', lang: 'zh', type: 'video' },
        ],
      },
    ],
  },
  {
    id: 'iot-cloud',
    title: '物联网云平台',
    icon: 'cloud',
    color: '#6366f1',
    description: '学习主流物联网云平台对接，实现设备接入、数据可视化与远程控制',
    duration: '2-3周',
    modules: [
      {
        id: 'iot-platforms',
        title: '主流IoT云平台',
        description: '阿里云IoT、腾讯云IoT、EMQX、ThingsBoard平台对接实战',
        topics: [
          '物联网平台架构概述',
          '阿里云IoT平台设备接入',
          '腾讯云IoT Explorer',
          'EMQX消息 Broker部署',
          'ThingsBoard开源平台',
          '物模型与产品定义',
          '设备影子机制',
        ],
        resources: [
          { title: '阿里云IoT文档', url: 'https://help.aliyun.com/document_detail/73742.html', lang: 'zh', type: 'doc' },
          { title: 'EMQX文档中心', url: 'https://docs.emqx.com/zh/enterprise/v5/', lang: 'zh', type: 'doc' },
          { title: 'ThingsBoard文档', url: 'https://thingsboard.io/docs/', lang: 'en', type: 'doc' },
        ],
      },
      {
        id: 'iot-projects',
        title: 'IoT综合项目实战',
        description: '智能家居、环境监测、远程控制系统设计与实现',
        topics: [
          '智能家居灯控系统',
          '温湿度监测站',
          '远程视频监控系统',
          'GPS追踪器设计',
          '太阳能能源监控',
          '项目部署与维护',
        ],
        resources: [
          { title: 'IoT项目合集 - Hackster', url: 'https://www.hackster.io/interest-map/internet-of-things', lang: 'en', type: 'project' },
          { title: 'DIY综合项目 - CSDN', url: 'https://blog.csdn.net/weixin_44752416/article/details/123456789', lang: 'zh', type: 'doc' },
        ],
      },
    ],
  },
  {
    id: 'pcb-design',
    title: 'PCB设计与硬件',
    icon: 'layers',
    color: '#84cc16',
    description: '从原理图到PCB，掌握Altium Designer/KiCad设计流程与生产文件输出',
    duration: '3-4周',
    modules: [
      {
        id: 'ad-basics',
        title: 'Altium Designer基础',
        description: '库管理、原理图绘制、ERC检查、PCB布局布线',
        topics: [
          'Altium Designer界面与工作区',
          '原理图库与PCB库创建',
          '原理图绘制与层次设计',
          'ERC电气规则检查',
          'PCB封装设计',
          'PCB层栈与规则设置',
          '布局规划与分区',
        ],
        resources: [
          { title: 'Altium Designer完整教程', url: 'https://www.bilibili.com/video/BV1bQ4y1n7jY', lang: 'zh', type: 'video' },
          { title: 'AD官方教程', url: 'https://www.altium.com/learn/training', lang: 'en', type: 'doc' },
        ],
      },
      {
        id: 'pcb-routing',
        title: 'PCB布线与生产',
        description: '高速布线原则、EMC设计、Gerber文件、PCB打样',
        topics: [
          '差分对布线',
          '阻抗控制与端接',
          '电源完整性设计',
          'EMC/EMI防护设计',
          '热设计与散热',
          'DFM可制造性设计',
          'Gerber文件与BOM输出',
          'PCB打样与SMT贴片',
        ],
        resources: [
          { title: 'PCB设计EMC指南', url: 'https://www.bilibili.com/video/BV1q4411H7Kx', lang: 'zh', type: 'video' },
          { title: 'PCB Design Rules - SparkFun', url: 'https://learn.sparkfun.com/tutorials/how-to-read-a-schematic/all', lang: 'en', type: 'doc' },
        ],
      },
    ],
  },
];
