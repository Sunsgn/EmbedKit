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
          { name: '数据类型与变量声明', content: 'C语言基本数据类型包括int、char、float、double等。嵌入式中常用stdint.h定义固定宽度类型如uint8_t、uint32_t，确保跨平台一致性。' },
          { name: '运算符与表达式', content: '包括算术运算符(+ - * / %)、关系运算符(> < == !=)、逻辑运算符(&& || !)、位运算符(& | ^ ~ << >>)。嵌入式中位运算用于寄存器操作。' },
          { name: '条件语句(if/switch)', content: 'if-else用于二选一或多分支判断，switch适用于多值匹配场景。嵌入式中switch常用于状态机实现和协议解析。' },
          { name: '循环语句(for/while/do-while)', content: 'for循环适合已知迭代次数，while适合条件控制，do-while保证至少执行一次。嵌入式中while(1)常用于主循环。' },
          { name: '函数定义与调用', content: '函数由返回类型、函数名、参数列表和函数体组成。C语言采用值传递，通过指针实现引用传递效果。static函数限制文件作用域。' },
          { name: '数组与字符串操作', content: '数组是同类型元素的连续内存块。字符串以\\0结尾，常用strlen、strcpy、strcat、strcmp等操作。注意数组越界问题。' },
          { name: '结构体与联合体', content: 'struct用于组合不同类型数据，union共享同一内存区域。嵌入式中常用union解析寄存器位域。注意struct内存对齐问题。' },
          { name: '预处理指令', content: '#define定义宏常量/函数宏，#include包含头文件，#ifdef/#ifndef条件编译，#pragma编译器指令。嵌入式中大量用于硬件抽象和条件编译。' },
        ],
        resources: [
          { title: 'C 语言教程', url: 'https://www.runoob.com/cprogramming/c-tutorial.html', lang: 'zh', type: 'doc' },
          { title: 'C Language Tutorial - W3Schools', url: 'https://www.w3schools.com/c/', lang: 'en', type: 'doc' },
          { title: 'C语言入门教程 - 黑马程序员', url: 'https://www.bilibili.com/video/BV1et411b7SU', lang: 'zh', type: 'video' },
        ],
        codeExample: `#include <stdio.h>
#include <string.h>
#include <stdint.h>

// 结构体定义 - 用于表示传感器数据
typedef struct {
    uint16_t temperature;  // 温度值 (°C * 10)
    uint16_t humidity;     // 湿度值 (%RH * 10)
    uint32_t timestamp;    // 时间戳
} SensorData;

// 联合体 - 解析32位寄存器
typedef union {
    uint32_t raw;
    struct {
        uint16_t value;    // 低16位数据
        uint8_t status;    // 状态字节
        uint8_t config;    // 配置字节
    } fields;
} Register_t;

// 条件编译
#define DEBUG_MODE 1
#if DEBUG_MODE
    #define DBG_PRINT(fmt, ...) printf("[DBG] " fmt "\\n", ##__VA_ARGS__)
#else
    #define DBG_PRINT(fmt, ...)
#endif

// 函数示例 - 查找数组最大值
int find_max(int *arr, size_t len) {
    if (!arr || len == 0) return -1;
    int max = arr[0];
    for (size_t i = 1; i < len; i++) {
        if (arr[i] > max) max = arr[i];
    }
    return max;
}

int main() {
    // 数组操作
    int temperatures[] = {23, 25, 22, 26, 24};
    printf("Max temp: %d\\n", find_max(temperatures, 5));
    
    // 结构体使用
    SensorData sensor = {.temperature = 250, .humidity = 600, .timestamp = 123456};
    printf("Temp: %d.%d°C, Humidity: %d.%d%%\\n",
           sensor.temperature / 10, sensor.temperature % 10,
           sensor.humidity / 10, sensor.humidity % 10);
    
    // 联合体使用
    Register_t reg;
    reg.fields.value = 0x1234;
    reg.fields.status = 0x01;
    reg.fields.config = 0x02;
    printf("Register raw: 0x%08X\\n", reg.raw);
    
    DBG_PRINT("Debug info: sensor timestamp = %lu", sensor.timestamp);
    return 0;}`,
        codeLang: 'c',
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
          { title: 'Pointers in C - W3Schools', url: 'https://www.w3schools.com/c/c_pointers.php', lang: 'en', type: 'doc' },
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
        codeExample: `#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// 链表节点
typedef struct Node {
    int data;
    struct Node *next;
} Node;

// 创建新节点
Node* create_node(int data) {
    Node *new_node = (Node*)malloc(sizeof(Node));
    new_node->data = data;
    new_node->next = NULL;
    return new_node;
}

// 头部插入
void push(Node **head, int data) {
    Node *new_node = create_node(data);
    new_node->next = *head;
    *head = new_node;
}

// 链表反转
Node* reverse_list(Node *head) {
    Node *prev = NULL, *curr = head, *next = NULL;
    while (curr) {
        next = curr->next;
        curr->next = prev;
        prev = curr;
        curr = next;
    }
    return prev;
}

// 循环队列
#define QUEUE_SIZE 8
typedef struct {
    int data[QUEUE_SIZE];
    int front, rear, count;
} CircularQueue;

void queue_init(CircularQueue *q) {
    q->front = q->rear = q->count = 0;
}

int queue_push(CircularQueue *q, int val) {
    if (q->count == QUEUE_SIZE) return 0;
    q->data[q->rear] = val;
    q->rear = (q->rear + 1) % QUEUE_SIZE;
    q->count++;
    return 1;
}

int queue_pop(CircularQueue *q, int *val) {
    if (q->count == 0) return 0;
    *val = q->data[q->front];
    q->front = (q->front + 1) % QUEUE_SIZE;
    q->count--;
    return 1;
}

int main() {
    // 链表操作
    Node *head = NULL;
    for (int i = 1; i <= 5; i++) push(&head, i);
    
    head = reverse_list(head);
    Node *p = head;
    while (p) { printf("%d ", p->data); p = p->next; }
    printf("\\n");
    
    // 循环队列
    CircularQueue q;
    queue_init(&q);
    for (int i = 1; i <= 5; i++) queue_push(&q, i * 10);
    int val;
    while (queue_pop(&q, &val)) printf("%d ", val);
    printf("\\n");
    return 0;}`,
        codeLang: 'c',
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
          { title: 'Basic Electronics - Electronics-Tutorials', url: 'https://www.electronics-tutorials.ws/', lang: 'en', type: 'doc' },
          { title: '电子技术基础(模拟部分) - 康华光', url: 'https://www.bilibili.com/video/BV1Yh411o7Qe', lang: 'zh', type: 'video' },
        ],
        codeExample: `// 模拟电路计算示例 - 使用Python进行电路分析
import numpy as np
import matplotlib.pyplot as plt

# RC低通滤波器频率响应
def rc_lowpass(f, R, C, f_c=None):
    """计算RC低通滤波器幅频响应"""
    if f_c is None:
        f_c = 1 / (2 * np.pi * R * C)  # 截止频率
    H = 1 / np.sqrt(1 + (f / f_c)**2)
    phase = -np.arctan(f / f_c) * 180 / np.pi
    return H, phase

# 参数设置
R = 1e3    # 1kΩ
C = 100e-9 # 100nF
f_c = 1 / (2 * np.pi * R * C)  # ≈ 1591 Hz

# 频率范围: 1Hz - 100kHz
frequencies = np.logspace(0, 5, 1000)
magnitude, phase = rc_lowpass(frequencies, R, C, f_c)

# 打印关键参数
print(f"截止频率: {f_c:.0f} Hz")
print(f"R={R*1e-3:.1f}kΩ, C={C*1e9:.0f}nF")

# 绘制波特图 (幅频 + 相频)
fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 8))

# 幅频特性 (dB)
mag_db = 20 * np.log10(magnitude)
ax1.semilogx(frequencies, mag_db, 'b-', linewidth=2)
ax1.axvline(f_c, color='r', linestyle='--', label=f'f_c={f_c:.0f}Hz')
ax1.axhline(-3, color='g', linestyle=':', label='-3dB')
ax1.set_xlabel('频率 (Hz)')
ax1.set_ylabel('增益 (dB)')
ax1.set_title('RC低通滤波器 - 幅频特性')
ax1.grid(True, which='both', alpha=0.3)
ax1.legend()

# 相频特性
ax2.semilogx(frequencies, phase, 'r-', linewidth=2)
ax2.axvline(f_c, color='r', linestyle='--', label=f'f_c={f_c:.0f}Hz')
ax2.set_xlabel('频率 (Hz)')
ax2.set_ylabel('相位 (度)')
ax2.set_title('RC低通滤波器 - 相频特性')
ax2.grid(True, which='both', alpha=0.3)
ax2.legend()

plt.tight_layout()
plt.savefig('rc_lowpass_bode.png', dpi=150)
plt.show()

# 二极管整流电路仿真
def half_wave_rectifier(v_in, v_diode=0.7):
    """半波整流: 输出 = max(Vin - Vd, 0)"""
    return np.where(v_in > v_diode, v_in - v_diode, 0)

t = np.linspace(0, 0.02, 1000)  # 20ms
v_in = 5 * np.sin(2 * np.pi * 50 * t)  # 50Hz, 5V峰值
v_out = half_wave_rectifier(v_in)

print(f"整流输出平均值: {np.mean(v_out):.3f} V")
print(f"整流输出RMS: {np.sqrt(np.mean(v_out**2)):.3f} V")`,
        codeLang: 'python',
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
        codeExample: `// Verilog数字电路仿真 - 4位同步计数器
module sync_counter_4bit (
    input  wire clk,
    input  wire rst_n,
    input  wire en,
    output reg  [3:0] q
);

    // 4位同步计数器
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            q <= 4'd0;
        else if (en)
            q <= q + 1'b1;
    end

    // 进位输出
    wire cout = (q == 4'd15) ? 1'b1 : 1'b0;
endmodule

// 有限状态机 - 交通灯控制器
module traffic_light (
    input  wire clk,
    input  wire rst_n,
    output reg  red,
    output reg  yellow,
    output reg  green
);

    typedef enum logic [1:0] {
        S_RED    = 2'd0,
        S_YELLOW = 2'd1,
        S_GREEN  = 2'd2
    } state_t;

    state_t current_state, next_state;
    reg [7:0] counter;
    
    // 状态转换
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) current_state <= S_RED;
        else current_state <= next_state;
    end

    // 下一状态逻辑
    always @(*) begin
        next_state = current_state;
        case (current_state)
            S_RED:    (counter == 8'd200) ? next_state = S_GREEN : next_state = S_RED;
            S_GREEN:  (counter == 8'd300) ? next_state = S_YELLOW : next_state = S_GREEN;
            S_YELLOW: (counter == 8'd50)  ? next_state = S_RED : next_state = S_YELLOW;
        endcase
    end

    // 计数器
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) counter <= 8'd0;
        else if (next_state != current_state) counter <= 8'd0;
        else counter <= counter + 1'b1;
    end

    // 输出逻辑
    always @(*) begin
        {red, yellow, green} = 3'b110;
        case (current_state)
            S_RED:    {red, yellow, green} = 3'b100;
            S_YELLOW: {red, yellow, green} = 3'b110;
            S_GREEN:  {red, yellow, green} = 3'b001;
        endcase
    end
endmodule`,
        codeLang: 'verilog',
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
          { title: 'KiCad PCB Design - Phil\'s Lab', url: 'https://www.youtube.com/@PhilsLab', lang: 'en', type: 'video' },
        ],
        codeExample: `// 原理图识读实战 - STM32最小系统电路分析
// ============================================================
// 1. 电源部分 (Power Supply)
//    5V USB -> AMS1117-3.3 LDO -> 3.3V
//    滤波: 100nF + 10uF 并联 (高频+低频)
//    保护: SB560防反接, PTC自恢复保险丝
//
//    VBUS(5V) ----|>|----+---- VIN(AMS1117)
//                  SB560  |
//                        +++ 10uF  --- 100nF
//                        GND       GND

// ============================================================
// 2. 复位电路 (Reset Circuit)
//    按键按下 -> NRST接地触发复位
//    松开 -> 10uF充电, NRST回到高电平
//
//    3.3V --/ /--+-- NRST(Pin)
//         10k    |
//         +++10uF [ ]按键
//         GND     |
//                GND

// ============================================================
// 3. SWD下载接口 (ST-Link)
//    PA13 -> SWDIO (双向数据)
//    PA14 -> SWCLK (时钟)
//    GND + 3.3V共地供电

// ============================================================
// 4. 8MHz晶振电路 (HSE Oscillator)
//    OSC_IN(PA0) --||-- 8MHz --||-- OSC_OUT(PA1)
//                      |            |
//                     22pF         22pF
//                      |            |
//                     GND          GND
//    注意: 晶振靠近芯片, 下方不铺铜`,
        codeLang: 'cpp',
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
          { title: 'STM32 HAL库文档', url: 'https://www.st.com/en/ecosystems/stm32-software.html', lang: 'en', type: 'doc' },
          { title: 'STM32入门教程 - 正点原子', url: 'https://www.bilibili.com/video/BV1KJ411d7Pb', lang: 'zh', type: 'video' },
          { title: 'STM32 HAL库开发详解', url: 'https://www.bilibili.com/video/BV15K411N7CF', lang: 'zh', type: 'video' },
        ],
        codeExample: `#include "stm32f1xx_hal.h"

// STM32时钟系统配置 - 72MHz SYSCLK
void SystemClock_Config(void) {
    RCC_OscInitTypeDef RCC_OscInitStruct = {0};
    RCC_ClkInitTypeDef RCC_ClkInitStruct = {0};

    // 1. 配置HSE外部8MHz晶振
    RCC_OscInitStruct.OscillatorType = RCC_OSCILLATORTYPE_HSE;
    RCC_OscInitStruct.HSEState = RCC_HSE_ON;
    RCC_OscInitStruct.HSEPredivValue = RCC_HSE_PREDIV_DIV1;
    RCC_OscInitStruct.PLL.PLLState = RCC_PLL_ON;
    RCC_OscInitStruct.PLL.PLLSource = RCC_PLLSOURCE_HSE;
    RCC_OscInitStruct.PLL.PLLMUL = RCC_PLL_MUL9; // 8MHz * 9 = 72MHz
    HAL_RCC_OscConfig(&RCC_OscInitStruct);

    // 2. 配置时钟分频 - AHB=72MHz, APB1=36MHz, APB2=72MHz
    RCC_ClkInitStruct.ClockType = RCC_CLOCKTYPE_HCLK | RCC_CLOCKTYPE_PCLK1 | RCC_CLOCKTYPE_PCLK2;
    RCC_ClkInitStruct.SYSCLKSource = RCC_SYSCLKSOURCE_PLLCLK;
    RCC_ClkInitStruct.AHBCLKDivider = RCC_SYSCLK_DIV1;    // APB2 max 36MHz -> /2
    RCC_ClkInitStruct.APB1CLKDivider = RCC_HCLK_DIV2;
    RCC_ClkInitStruct.APB2CLKDivider = RCC_HCLK_DIV1;
    HAL_RCC_ClockConfig(&RCC_ClkInitStruct, FLASH_LATENCY_2);
}

// NVIC中断优先级配置
void NVIC_Config(void) {
    // 抢占优先级2位, 子优先级2位
    HAL_NVIC_SetPriorityGrouping(NVIC_PRIORITYGROUP_2);

    // 配置USART1中断: 抢占优先级1, 子优先级0
    HAL_NVIC_SetPriority(USART1_IRQn, 1, 0);
    HAL_NVIC_EnableIRQ(USART1_IRQn);

    // 配置TIM2中断: 抢占优先级2, 子优先级1
    HAL_NVIC_SetPriority(TIM2_IRQn, 2, 1);
    HAL_NVIC_EnableIRQ(TIM2_IRQn);
}

// 中断优先级规则:
// 1. 高抢占优先级可以打断低抢占优先级的运行任务
// 2. 相同抢占优先级时, 高子优先级先响应
// 3. 相同抢占+子优先级时, 硬件编号低的先响应`,
        codeLang: 'c',
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
          { title: 'STM32 GPIO HAL库详解', url: 'https://community.st.com/t5/stm32-mcus-wiki/stm32l4-gpio-configuration-using-hal-driver/ta-p/568505', lang: 'en', type: 'doc' },
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
        codeExample: `#include "stm32f1xx_hal.h"

TIM_HandleTypeDef htim2;

// PWM配置: TIM2 CH1, 频率=10kHz, 占空比可调
void MX_TIM2_PWM_Init(void) {
    TIM_OC_InitTypeDef sConfigOC = {0};

    htim2.Instance = TIM2;
    htim2.Init.Prescaler = 71;           // 72MHz / (71+1) = 1MHz
    htim2.Init.CounterMode = TIM_COUNTERMODE_UP;
    htim2.Init.Period = 99;              // 1MHz / (99+1) = 10kHz
    htim2.Init.ClockDivision = TIM_CLOCKDIVISION_DIV1;
    HAL_TIM_PWM_Init(&htim2);

    sConfigOC.OCMode = TIM_OCMODE_PWM1;
    sConfigOC.Pulse = 50;                // 初始占空比50%
    sConfigOC.OCPolarity = TIM_OCPOLARITY_HIGH;
    HAL_TIM_PWM_ConfigChannel(&htim2, &sConfigOC, TIM_CHANNEL_1);
    HAL_TIM_PWM_Start(&htim2, TIM_CHANNEL_1);
}

// 动态调整PWM占空比 (0-100%)
void SetPWM_DutyCycle(uint8_t percent) {
    __HAL_TIM_SET_COMPARE(&htim2, TIM_CHANNEL_1, (uint16_t)(percent * 99 / 100));
}

// 输入捕获 - 测量PWM频率和占空比
TIM_HandleTypeDef htim3;
uint32_t capture1 = 0, capture2 = 0;
uint32_t pwm_period = 0, pwm_duty = 0;

void HAL_TIM_IC_CaptureCallback(TIM_HandleTypeDef *htim) {
    if (htim->Channel == HAL_TIM_ACTIVE_CHANNEL_1) {
        static uint8_t state = 0;
        if (state == 0) {
            capture1 = HAL_TIM_ReadCapturedValue(htim, TIM_CHANNEL_1);
            state = 1;
        } else if (state == 1) {
            capture2 = HAL_TIM_ReadCapturedValue(htim, TIM_CHANNEL_1);
            pwm_period = (capture2 > capture1) ? (capture2 - capture1) : (65535 - capture1 + capture2);
            pwm_duty = (capture2 > capture1) ? capture1 : (capture1 - capture2);
            state = 0;
        }
    }
}`,
        codeLang: 'c',
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
        codeExample: `#include "stm32f1xx_hal.h"

ADC_HandleTypeDef hadc1;
DMA_HandleTypeDef hdma_adc1;
uint16_t adc_buffer[4]; // 4通道采样数据

// ADC+DMA多通道配置
void MX_ADC1_DMA_Init(void) {
    ADC_ChannelConfTypeDef sConfig = {0};

    hadc1.Instance = ADC1;
    hadc1.Init.ScanConvMode = ENABLE;       // 扫描模式(多通道)
    hadc1.Init.ContinuousConvMode = ENABLE;  // 连续转换
    hadc1.Init.ExternalTrigConv = ADC_SOFTWARE_START;
    hadc1.Init.DataAlign = ADC_DATAALIGN_RIGHT;
    hadc1.Init.NbrOfConversion = 4;         // 4个通道
    HAL_ADC_Init(&hadc1);

    // 通道配置: CH0(温度), CH1(电位器), CH2(光敏), CH3(电池电压)
    sConfig.Channel = ADC_CHANNEL_0;
    sConfig.Rank = 1;
    sConfig.SamplingTime = ADC_SAMPLETIME_239CYCLES_5;
    HAL_ADC_ConfigChannel(&hadc1, &sConfig);

    sConfig.Channel = ADC_CHANNEL_1; sConfig.Rank = 2;
    HAL_ADC_ConfigChannel(&hadc1, &sConfig);
    sConfig.Channel = ADC_CHANNEL_2; sConfig.Rank = 3;
    HAL_ADC_ConfigChannel(&hadc1, &sConfig);
    sConfig.Channel = ADC_CHANNEL_3; sConfig.Rank = 4;
    HAL_ADC_ConfigChannel(&hadc1, &sConfig);

    // DMA配置
    hdma_adc1.Instance = DMA1_Channel1;
    hdma_adc1.Init.Direction = DMA_PERIPH_TO_MEMORY;
    hdma_adc1.Init.PeriphInc = DMA_PINC_DISABLE;
    hdma_adc1.Init.MemInc = DMA_MINC_ENABLE;
    hdma_adc1.Init.PeriphDataAlignment = DMA_PDATAALIGN_HALFWORD;
    hdma_adc1.Init.MemDataAlignment = DMA_MDATAALIGN_HALFWORD;
    hdma_adc1.Init.Mode = DMA_CIRCULAR;
    HAL_DMA_Init(&hdma_adc1);
    __HAL_LINKDMA(&hadc1, DMA_Handle, hdma_adc1);

    HAL_ADCEx_ExternalTrigConvStart_DMA(&hadc1, (uint32_t*)adc_buffer, 4);
}

// ADC数据转换 -> 电压值
float ADC_ToVoltage(uint16_t adc_value) {
    return (float)adc_value * 3.3f / 4095.0f;
}

// DAC正弦波生成
void GenerateSineWave_DAC(void) {
    // 预计算正弦波查表 (256个点)
    static const uint16_t sine_table[256] = {
        [0 ... 255] = 2048  // 初始化, 实际需计算 sin(x) * 2047 + 2048
    };
    // 使用TIM触发DAC, 输出指定频率正弦波
}`,
        codeLang: 'c',
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
        codeExample: `#include "stm32f1xx_hal.h"

I2C_HandleTypeDef hi2c1;
SPI_HandleTypeDef hspi1;

// ============================================================
// I2C - SSD1306 OLED驱动 (128x64, 0x3C地址)
// ============================================================
void OLED_Init(void) {
    uint8_t cmd[] = {
        0xAE, // 显示关闭
        0xD5, 0x80, // 设置时钟分频
        0xA8, 0x3F, // 设置驱动路数64
        0xD3, 0x00, // 设置显示偏移
        0x40, // 设置起始行
        0x8D, 0x14, // 电荷泵使能
        0xAF, // 显示开启
    };
    for (int i = 0; i < sizeof(cmd); i++) {
        // HAL_I2C_Mem_Write(hi2c1, 0x3C, 0x00, 1, &cmd[i], 1, 100);
    }
}

void OLED_WriteData(uint8_t* data, uint16_t len) {
    HAL_I2C_Mem_Write(&hi2c1, 0x3C << 1, 0x40, 1, data, len, 100);
}

// ============================================================
// SPI - W25Qxx Flash驱动 (W25Q128, 16MB)
// ============================================================
#define W25Q_CS_LOW()   HAL_GPIO_WritePin(GPIOB, GPIO_PIN_0, GPIO_PIN_RESET)
#define W25Q_CS_HIGH()  HAL_GPIO_WritePin(GPIOB, GPIO_PIN_0, GPIO_PIN_SET)

uint8_t W25Q_Transfer(uint8_t data) {
    uint8_t rx;
    HAL_SPI_TransmitReceive(&hspi1, &data, &rx, 1, 1000);
    return rx;
}

void W25Q_WriteEnable(void) {
    W25Q_CS_LOW();
    W25Q_Transfer(0x06); // WREN指令
    W25Q_CS_HIGH();
}

uint32_t W25Q_ReadDeviceID(void) {
    uint32_t id = 0;
    W25Q_CS_LOW();
    W25Q_Transfer(0x9F); // RDID指令
    id = (W25Q_Transfer(0) << 24) | (W25Q_Transfer(0) << 16) |
         (W25Q_Transfer(0) << 8) | W25Q_Transfer(0);
    W25Q_CS_HIGH();
    return id; // W25Q128返回 0xEF4018
}

void W25Q_PageProgram(uint32_t addr, uint8_t* data, uint16_t len) {
    W25Q_WriteEnable();
    W25Q_CS_LOW();
    W25Q_Transfer(0x02); // PP指令
    W25Q_Transfer((addr >> 16) & 0xFF);
    W25Q_Transfer((addr >> 8) & 0xFF);
    W25Q_Transfer(addr & 0xFF);
    for (uint16_t i = 0; i < len; i++) {
        W25Q_Transfer(data[i]);
    }
    W25Q_CS_HIGH();
    // 等待写操作完成 (轮询BUSY位)
}`,
        codeLang: 'c',
      },
    ],
  },
  {
    id: 'stm32-advanced-peripherals',
    title: 'DMA、NVIC与看门狗',
    icon: 'cpu',
    color: '#0ea5e9',
    description: '深入学习DMA直接存储器访问、NVIC中断管理和看门狗定时器',
    duration: '1-2周',
    modules: [
      {
        id: 'dma-nvic-watchdog',
        title: 'DMA、NVIC与看门狗',
        description: '深入学习DMA直接存储器访问、NVIC中断管理和看门狗定时器',
        topics: [
      {
        name: 'DMA原理与应用',
        content: `DMA(Direct Memory Access)允许外设与内存之间直接传输数据而无需CPU干预，极大提高了数据吞吐效率。

核心概念：
• DMA通道与请求线：每个外设对应特定DMA通道，STM32F1有2个DMA控制器共12个通道。
• 传输方向：外设到内存、内存到外设、内存到内存、外设到外设。
• 数据宽度：支持字节(8bit)、半字(16bit)、字(32bit)传输。
• 循环模式：使能后传输自动重新加载NDTR寄存器，适用于ADC连续采样、UART循环接收。
• 中断与DMA请求优先级：当多个外设同时请求DMA时，由硬件优先级和软件优先级共同决定。

典型应用场景：
• ADC连续采样到内存缓冲区
• UART循环接收（双缓冲乒乓操作）
• SPI/I2C高速数据传输
• DAC波形输出
• SDIO/USB大容量数据传输`,
      },
      {
        name: 'NVIC中断管理',
        content: `NVIC(Nested Vectored Interrupt Controller)是Cortex-M内核的中断管理核心。

核心概念：
• 中断优先级分组：将4位优先级分为抢占优先级和子优先级。STM32 HAL库使用HAL_NVIC_SetPriorityGrouping()配置。
• 抢占优先级：高抢占优先级可以打断低抢占优先级的正在执行的中断。
• 子优先级：当抢占优先级相同时，先发生的子优先级高的中断先响应。
• 中断嵌套：Cortex-M支持中断嵌套，进入中断时自动保存上下文到栈。
• PendSV与SysTick：PendSV用于低优先级上下文切换，SysTick用于系统定时。

配置步骤：
1. HAL_NVIC_SetPriority()设置中断优先级
2. HAL_NVIC_EnableIRQ()使能中断
3. 重写IRQHandler处理函数
4. 在中断中调用HAL_xxx_IRQHandler处理具体事件`,
      },
      {
        name: '看门狗定时器',
        content: `看门狗用于检测程序跑飞并自动复位系统，分为独立看门狗(IWDG)和窗口看门狗(WWDG)。

独立看门狗(IWDG)：
• 使用独立LSI时钟(约40kHz)，主时钟故障时仍能工作。
• 配置预分频器和重装载值设定超时时间：Timeout = (prescaler × reload) / LSI_freq。
• 必须定期喂狗（写入重装载值），否则计数器溢出触发复位。
• 适用于长时间运行的关键任务，如飞行控制器、医疗设备。

窗口看门狗(WWDG)：
• 使用主时钟，精度更高。
• 计数器必须在窗口期内喂狗：过早或过晚都会触发复位。
• 适用于对任务周期有严格要求的系统。
• 窗口上限=0x7F，下限由配置寄存器W[5:0]设定。

最佳实践：
• 在main循环或定时中断中喂狗
• 关键外设任务完成后喂狗
• 调试期间可暂时关闭看门狗
• 生产环境务必启用`,
      },
    ],
    resources: [
      { title: 'STM32 DMA详解 - STM32参考手册', url: 'https://www.st.com/resource/en/reference_manual/dm00031020.pdf', lang: 'en', type: 'doc' },
      { title: 'DMA教程 - 野火', url: 'https://blog.csdn.net/morixinguan/article/details/120438936', lang: 'zh', type: 'doc' },
      { title: 'NVIC中断优先级详解', url: 'https://www.bilibili.com/video/BV1Yh411K7Lb', lang: 'zh', type: 'video' },
      { title: '看门狗定时器教程', url: 'https://www.st.com/resource/en/application_note/an2603-how-to-avoid-latent-faults-in-your-embedded-system-with-the-watchdog-timers-stmicroelectronics.pdf', lang: 'en', type: 'doc' },
    ],
    codeExample: `// ============================================
// DMA + ADC 连续采样示例
// ============================================
#include "stm32f1xx_hal.h"

DMA_HandleTypeDef hdma_adc1;
ADC_HandleTypeDef hadc1;
uint16_t adcBuffer[16];  // 采样缓冲区

void DMA_ADC_Init(void) {
    // DMA配置
    hdma_adc1.Instance = DMA1_Channel1;
    hdma_adc1.Init.Direction = DMA_PERIPH_TO_MEMORY;
    hdma_adc1.Init.PeriphInc = DMA_PINC_DISABLE;  // 外设地址固定
    hdma_adc1.Init.MemInc = DMA_MINC_ENABLE;       // 内存地址递增
    hdma_adc1.Init.PeriphDataAlignment = DMA_PDATAALIGN_HALFWORD;
    hdma_adc1.Init.MemDataAlignment = DMA_MDATAALIGN_HALFWORD;
    hdma_adc1.Init.Mode = DMA_CIRCULAR;            // 循环模式
    hdma_adc1.Init.Priority = DMA_PRIORITY_HIGH;
    HAL_DMA_Init(&hdma_adc1);
    __HAL_LINKDMA(&hadc1, DMA_Handle, hdma_adc1);

    // ADC配置
    hadc1.Instance = ADC1;
    hadc1.Init.ScanConvMode = ENABLE;              // 扫描多通道
    hadc1.Init.ContinuousConvMode = ENABLE;         // 连续转换
    hadc1.Init.ExternalTrigConv = ADC_SOFTWARE_START;
    hadc1.Init.NbrOfChannel = 4;                   // 4个通道
    HAL_ADC_Init(&hadc1);

    // 配置通道
    ADC_ChannelConfTypeDef sConfig = {0};
    sConfig.Rank = ADC_REGULAR_RANK_1;
    sConfig.SamplingTime = ADC_SAMPLETIME_239CYCLES_5;
    sConfig.Channel = ADC_CHANNEL_0;
    HAL_ADC_ConfigChannel(&hadc1, &sConfig);

    // 启动DMA传输
    HAL_ADC_Start_DMA(&hadc1, (uint32_t*)adcBuffer, 16);
}

// ============================================
// NVIC中断优先级配置
// ============================================
void NVIC_Config(void) {
    // 设置优先级分组: 2位抢占 + 2位子优先级
    HAL_NVIC_SetPriorityGrouping(NVIC_PRIORITYGROUP_2);

    // 配置各个中断优先级
    HAL_NVIC_SetPriority(USART1_IRQn, 0, 0);    // 最高抢占优先级
    HAL_NVIC_SetPriority(TIM2_IRQn, 1, 0);      // 定时器中断
    HAL_NVIC_SetPriority(ADC1_IRQn, 1, 1);      // ADC转换完成
    HAL_NVIC_SetPriority(DMA1_Channel1_IRQn, 2, 0);

    // 使能中断
    HAL_NVIC_EnableIRQ(USART1_IRQn);
    HAL_NVIC_EnableIRQ(TIM2_IRQn);
    HAL_NVIC_EnableIRQ(ADC1_IRQn);
    HAL_NVIC_EnableIRQ(DMA1_Channel1_IRQn);
}

// ============================================
// 独立看门狗(IWDG)配置
// ============================================
IWDG_HandleTypeDef hiwdg;

void IWDG_Init(void) {
    hiwdg.Instance = IWDG;
    // 超时 = 64 * 1250 / 40000 ≈ 2秒
    hiwdg.Init.Preload = 1250;
    hiwdg.Init.ReloadCounter = 1250;
    hiwdg.Init.Window = IWDG_WINDOW_DISABLE;
    hiwdg.Init.Prescaler = IWDG_PRESCALER_64;
    HAL_IWDG_Init(&hiwdg);
}

// 在主循环或定时任务中喂狗
void MainLoop(void) {
    while (1) {
        HAL_IWDG_Refresh(&hiwdg);  // 喂狗
        ProcessSensorData();
        HandleCommunication();
        HAL_Delay(100);
    }
}`,
    codeLang: 'c',
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
          { title: 'I2C协议详解 - NXP应用笔记', url: 'https://www.nxp.com/docs/en/application-note/AN03377.pdf', lang: 'en', type: 'doc' },
          { title: 'SPI vs I2C vs UART', url: 'https://www.rs-online.com/designspark/spi-vs-i2c-vs-uart', lang: 'en', type: 'doc' },
        ],
        codeExample: `// UART多机通信示例 - 使用地址帧区分目标从机
#include "stm32f1xx_hal.h"

UART_HandleTypeDef huart1;

// 发送一帧数据 (起始符 + 地址 + 命令 + 数据 + 校验和)
typedef struct {
    uint8_t start;   // 0xAA 帧起始
    uint8_t addr;    // 目标地址
    uint8_t cmd;     // 命令字
    uint8_t data[32];
    uint8_t len;     // 数据长度
    uint8_t checksum;
} UART_Frame_t;

uint8_t calcChecksum(UART_Frame_t* frame) {
    uint8_t sum = 0;
    sum += frame->addr + frame->cmd + frame->len;
    for (int i = 0; i < frame->len; i++) sum += frame->data[i];
    return sum;
}

void UART_SendFrame(UART_Frame_t* frame) {
    frame->start = 0xAA;
    frame->checksum = calcChecksum(frame);
    HAL_UART_Transmit(&huart1, (uint8_t*)&frame->start, 1, 100);
    HAL_UART_Transmit(&huart1, (uint8_t*)&frame->addr, 1, 100);
    HAL_UART_Transmit(&huart1, (uint8_t*)&frame->cmd, 1, 100);
    HAL_UART_Transmit(&huart1, (uint8_t*)&frame->len, 1, 100);
    if (frame->len > 0)
        HAL_UART_Transmit(&huart1, frame->data, frame->len, 100);
    HAL_UART_Transmit(&huart1, (uint8_t*)&frame->checksum, 1, 100);
}

// I2C多设备扫描
uint8_t I2C_ScanDevices(void) {
    uint8_t count = 0;
    for (uint8_t addr = 1; addr < 128; addr++) {
        if (HAL_I2C_IsDeviceReady(&hi2c1, addr << 1, 3, 100) == HAL_OK) {
            printf("Found device at 0x%02X\\n", addr);
            count++;
        }
    }
    return count;
}`,
        codeLang: 'c',
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
        'CAN FD协议与动态波特率',
        'RS485多机通信与半双工切换',
        'RS485故障诊断与终端电阻',
        ],
        resources: [
          { title: 'CAN总线协议详解', url: 'https://www.bilibili.com/video/BV1qY411d7XB', lang: 'zh', type: 'video' },
          { title: 'Modbus协议入门', url: 'https://modbus.org/specs.php', lang: 'en', type: 'doc' },
          { title: 'CAN FD规范', url: 'https://www.bosch.com/en/en/innovation/topics/can-fd.html', lang: 'en', type: 'doc' },
        ],
        codeExample: `// Modbus RTU从站示例 - RS485通信
#include "stm32f1xx_hal.h"

// Modbus寄存器表
uint16_t HoldingRegs[100] = {0};  // 保持寄存器 (4x)
uint16_t InputRegs[50] = {0};     // 输入寄存器 (3x)
uint8_t Coils[256] = {0};         // 线圈输出 (0x)
uint8_t DiscreteInputs[256] = {0}; // 离散输入 (1x)

// Modbus RTU帧结构
typedef struct {
    uint8_t  slaveAddr;
    uint8_t  functionCode;
    uint16_t startAddr;
    uint16_t quantity;
    uint8_t  dataLen;
    uint8_t  data[252];
    uint16_t crc;
} ModbusFrame_t;

// CRC16-MODBUS计算
uint16_t CRC16(const uint8_t* data, uint16_t len) {
    uint16_t crc = 0xFFFF;
    for (uint16_t i = 0; i < len; i++) {
        crc ^= data[i];
        for (int j = 0; j < 8; j++) {
            crc = (crc & 1) ? (crc >> 1) ^ 0xA001 : crc >> 1;
        }
    }
    return crc;
}

// 功能码03: 读取保持寄存器
void FC03_Response(ModbusFrame_t* frame, uint8_t* resp) {
    uint16_t start = frame->startAddr;
    uint16_t qty = frame->quantity;
    if (start + qty > 100) {
        // 异常响应: 非法地址
        resp[0] = frame->slaveAddr; resp[1] = 0x83; resp[2] = 0x02;
        return;
    }
    resp[0] = frame->slaveAddr;
    resp[1] = 0x03;
    resp[2] = qty * 2; // 字节数
    for (uint16_t i = 0; i < qty; i++) {
        resp[3 + i*2]   = (HoldingRegs[start + i] >> 8) & 0xFF;
        resp[3 + i*2+1] = HoldingRegs[start + i] & 0xFF;
    }
    uint16_t crc = CRC16(resp, 3 + qty * 2);
    resp[3 + qty*2]   = crc & 0xFF;
    resp[3 + qty*2+1] = (crc >> 8) & 0xFF;
}

// 功能码06: 写入单个保持寄存器
void FC06_Process(ModbusFrame_t* frame) {
    uint16_t addr = frame->startAddr;
    uint16_t value = (frame->data[0] << 8) | frame->data[1];
    if (addr < 100) HoldingRegs[addr] = value;
}`,
        codeLang: 'c',
      },
      {
        id: 'wireless-protocols',
        title: '无线与低功耗协议',
        description: 'LoRa、Zigbee、BLE无线通信协议',
        topics: [
          {
            name: 'LoRa长距离通信',
            content: `LoRa(Long Range)是Semtech开发的扩频调制技术，适用于远距离低功耗通信。

核心概念：
• 扩频因子(SF)：SF7-SF12，越高距离越远但速率越低。
• 带宽(BW)：125kHz/250kHz/500kHz，带宽越大抗干扰能力越强。
• 编码率(CR)：4/5-4/8，冗余越多纠错能力越强。
• 发射功率：最大20dBm(EU868)/30dBm(US915)。
• 传输距离：开阔地可达15km，城市环境2-5km。

LoRaWAN协议栈：
• 终端节点：ABP和OTAA两种激活方式
• 网关：透明转发，星型拓扑
• 网络服务器：处理去重、加密、ADR
• 应用服务器：业务逻辑处理

典型应用：
• 智慧农业：土壤湿度、气象站监测
• 智慧城市：智能水表、燃气表
• 资产追踪：物流追踪、围栏检测`,
          },
          {
            name: 'Zigbee网状网络',
            content: `Zigbee基于IEEE 802.15.4标准，适用于短距离低功耗网状网络。

网络拓扑：
• 星型拓扑：协调器为中心，终端设备直接连接。
• 树状拓扑：路由器转发数据，扩展覆盖范围。
• 网状拓扑：设备间多跳路由，高可靠性。

设备类型：
• 协调器(Coordinator)：网络创建者，PAN ID分配
• 路由器(Router)：数据转发，可扩展网络覆盖
• 终端设备(End Device)：低功耗，睡眠唤醒机制

Zigbee协议栈：
• MAC层：CSMA-CA、GTS时隙、ACK确认
• NWK层：路由算法(AODV)、地址分配
• 应用层：ZCL簇定义、绑定机制

与BLE对比：
• Zigbee：多设备组网，低延迟，适合智能家居
• BLE：手机直连，高带宽，适合穿戴设备`,
          },
          {
            name: 'BLE蓝牙低功耗',
            content: `Bluetooth Low Energy是蓝牙4.0引入的低功耗无线技术。

连接模式：
• 广播模式：设备广播数据，无需连接
• 连接模式：主从设备建立连接，传输数据
• 广播观察：观察者接收广播数据

GATT协议：
• Service：功能集合，如心率服务
• Characteristic：数据单元，包含Value和Properties
• Descriptor：特性描述，如客户端特征配置
• UUID：16位短UUID或128位标准UUID

连接参数：
• 连接间隔：7.5ms-4s，影响功耗和延迟
• 从机延迟：0-499，从机可跳过的连接事件数
• 监督超时：100ms-32s，无响应断开时间

典型应用：
• 健康医疗：心率带、血糖仪
• 智能家居：门锁、传感器
• 工业IoT：设备监控、预测性维护`,
          },
        ],
        resources: [
          { title: 'LoRaWAN官方规范', url: 'https://lora-alliance.org/resource_hub/loraWAN/', lang: 'en', type: 'doc' },
          { title: 'Zigbee规范文档', url: 'https://csa-iot.org/all-solutions/zigbee/', lang: 'en', type: 'doc' },
          { title: 'BLE核心规范', url: 'https://www.bluetooth.com/specifications/bluetooth-core-specification/', lang: 'en', type: 'doc' },
          { title: 'LoRa教程 - 野火', url: 'https://blog.csdn.net/morixinguan/article/details/121322598', lang: 'zh', type: 'doc' },
        ],
        codeExample: `// LoRa发送示例 - 使用RFM95模块
#include "rfm95.h"

RFM95 lora;

void LoRa_Init(void) {
    SPI_Init();
    lora.begin();
    lora.setFrequency(868.0);        // EU868频段
    lora.setSpreadingFactor(7);      // SF7, 最高速率
    lora.setSignalBandwidth(125E3);  // 125kHz带宽
    lora.setCodingRate4(5);          // CR=4/5
    lora.setOutputPower(17);         // 17dBm
    lora.setGain(0);                 // 自动增益
}

void LoRa_Send(const char* message) {
    lora.sleep();
    lora.transmit();
    lora.write(message);
    lora.waitPacketSent();
    lora.readAll();
}

char* LoRa_Receive() {
    if (lora.receive()) {
        char* packet = (char*)malloc(lora.getRSSI());
        lora.read(packet);
        return packet;
    }
    return NULL;
}

// BLE GATT服务定义示例 (NRF52)
#include "ble.h"
#include "ble_hci.h"

// 自定义服务UUID: 0x00001523-1212-EFDE-1523-785FEABCD123
#define CUSTOM_SERVICE_UUID     0x1523
#define CUSTOM_CHAR_UUID        0x1524

// 特征值属性: 可读+可写+通知
#define CUSTOM_CHAR_PROPERTIES  (BLE_GATT_CHAR_PROPERTIES_READ | \\
                                 BLE_GATT_CHAR_PROPERTIES_WRITE | \\
                                 BLE_GATT_CHAR_PROPERTIES_NOTIFY)

static uint8_t custom_char_value = 0;

// GATT属性表
static ble_gatts_char_md_t char_md = {
    .char_props = {
        .read = 1,
        .write = 1,
        .notify = 1,
    },
};

static ble_gatts_attr_md_t char_attr_md = {
    .vsd = 0,
    .rd_auth = 0,
    .wr_auth = 0,
};

static ble_gatts_attr_t char_attr = {
    .uuid = &CUSTOM_CHAR_UUID,
    .attr_md = &char_attr_md,
    .init_len = sizeof(uint8_t),
    .init_offs = 0,
    .max_len = sizeof(uint8_t),
    .p_value = &custom_char_value,
};`,
        codeLang: 'c',
      },
    ],
  },
  {
    id: 'debugging',
    title: '调试技术与工具',
    icon: 'bug',
    color: '#f59e0b',
    description: '掌握JTAG/SWD调试接口、逻辑分析仪、串口调试和嵌入式调试技巧',
    duration: '1-2周',
    modules: [
      {
        id: 'debug-interfaces',
        title: '调试接口与硬件',
        description: 'JTAG、SWD调试协议与硬件调试器使用',
        topics: [
          {
            name: 'JTAG调试协议',
            content: `JTAG(JTAG Test Action Group)是IEEE 1149.1标准边界扫描测试接口，也被广泛用于嵌入式调试。

引脚定义：
• TCK(Test Clock)：测试时钟信号
• TMS(Test Mode Select)：状态机控制信号
• TDI(Test Data In)：数据输入
• TDO(Test Data Out)：数据输出
• TRST(Test Reset)：测试复位(可选)

JTAG状态机：
• Test-Logic-Reset -> Run-Test/Idle -> Select-DR-Scan -> Capture-DR -> Shift-DR -> Exit1-DR -> Update-DR
• 通过TMS信号序列控制状态转移

调试功能：
• 内存读写：通过DMI/DAP访问内部SRAM和Flash
• 寄存器读写：访问CPU核心寄存器和外设寄存器
• 断点设置：硬件断点(FlashPatch)和软件断点(BKPT指令)
• 单步执行：Step模式逐条指令执行`,
          },
          {
            name: 'SWD调试协议',
            content: `SWD(Serial Wire Debug)是ARM Cortex-M的串行调试接口，仅需2根信号线。

引脚定义：
• SWCLK：串行时钟
• SWDIO：双向数据线
• SWDIO、SWDIO和GND

优势：
• 引脚更少：相比JTAG的4根线，SWD只需2根信号线。
• 兼容ARM CoreSight：支持相同调试功能，包括断点、数据观察点、追溯等。
• 更低的引脚开销：适合引脚受限MCU

调试器选择：
• ST-Link V2/V3：STM32官方调试器，支持SWD/JTAG
• J-Link：Segger出品，性能最强，支持虚拟串口
• DAPLink：开源调试器，支持Mass Storage模式
• CMSIS-DAP：ARM官方开源方案，兼容性好`,
          },
          {
            name: '逻辑分析仪使用',
            content: `逻辑分析仪用于捕获数字信号时序，是嵌入式调试必备工具。

推荐工具：
• Saleae Logic 2：专业级，8-16通道，支持协议解码
• DSLogic Plus：开源方案，配合PulseView使用
• NanoVNA：入门级，支持基础协议解码

常见用途：
• 验证I2C/SPI/UART通信时序
• 分析PWM信号占空比和频率
• 调试自定义协议时序
• 测量中断响应延迟
• 分析电源时序和启动过程

PulseView使用技巧：
• 添加协议解码器：I2C、SPI、UART、CAN、1-Wire等
• 设置采样率：至少10倍于信号频率
• 使用标记功能标注关键事件
• 导出CSV数据用于进一步分析`,
          },
        ],
        resources: [
          { title: 'Cortex-M3 Technical Reference Manual', url: 'https://developer.arm.com/documentation/ddi0337/e/', lang: 'en', type: 'doc' },
          { title: 'JTAG协议详解', url: 'https://www.bilibili.com/video/BV1cY411d7XB', lang: 'zh', type: 'video' },
          { title: 'Saleae Logic分析教程', url: 'https://support.saleae.com/getting-started', lang: 'en', type: 'doc' },
          { title: 'PulseView逻辑分析仪', url: 'https://sigrok.org/', lang: 'en', type: 'project' },
        ],
        codeExample: `// ============================================
// SWD调试示例 - OpenOCD配置脚本
// ============================================
# 文件: stm32f1.cfg (OpenOCD配置)

# 选择调试器
interface stlink
transport select hla_swd

# 选择目标芯片
set CHIPNAME stm32f103xc
source [find target/stm32f1x.cfg]

# 工作区域大小
adapter speed 1000  ;# SWD时钟1MHz

# 复位配置
reset_config srst_only srst_nogate

# ============================================
# GDB调试命令示例
# ============================================
# 连接目标
target extended-remote :3333

# 加载符号表
symbol-file firmware.elf

# 设置断点
break main
break HAL_UART_Receive_Callback
hardware break 0x08001234  ;# 硬件断点

# 继续/单步
continue
step
next

# 查看内存
x/16xw 0x20000000          ;# 查看SRAM起始
x/32xb 0x40013800          ;# 查看USART寄存器

# 查看寄存器
info registers
print/h USART1->SR

# 监视变量
watch adcBuffer[0]

# ============================================
# ST-Link Utility命令行烧录
# ============================================
# st-flash write firmware.bin 0x08000000
# st-info --probe              ;# 探测连接设备
# st-info --uid                ;# 读取设备UID`,
        codeLang: 'bash',
      },
      {
        id: 'debug-techniques',
        title: '调试技巧与实践',
        description: '串口调试、LED状态指示、断言使用和故障排查方法',
        topics: [
          'printf重定向与格式化输出',
          'LED状态机指示系统状态',
          'HAL断言使用与自定义处理',
          'HardFault异常分析与堆栈回溯',
          '内存泄漏检测方法',
          '性能分析与基准测试',
          '远程调试与无线调试',
        ],
        resources: [
          { title: 'HardFault调试指南 - ARM', url: 'https://www.arm.com/support/answers/hardfault.php', lang: 'en', type: 'doc' },
          { title: '嵌入式调试技巧汇总', url: 'https://www.bilibili.com/video/BV1Yh411K7Lb', lang: 'zh', type: 'video' },
        ],
        codeExample: `// ============================================
// printf重定向到USART1
// ============================================
#include <stdio.h>
#include "stm32f1xx_hal.h"

extern UART_HandleTypeDef huart1;

// 方法1: 重写fputc (C标准库)
int fputc(int ch, FILE *f) {
    HAL_UART_Transmit(&huart1, (uint8_t*)&ch, 1, 10);
    return ch;
}

// 方法2: 重写_putchar (ARM Compiler)
int _ttywrch(int ch) {
    HAL_UART_Transmit(&huart1, (uint8_t*)&ch, 1, 10);
    return ch;
}

// ============================================
// HardFault异常处理 - 分析故障原因
// ============================================
void HardFault_Handler(void) {
    while(1) {
        // 进入HardFault后读取关键寄存器
        uint32_t stacked_csr = *(volatile uint32_t*)(((uint32_t)SCB->HFSR & SCB_HFSR_VECTACTIVE_Msk) ? \
            ((uint32_t)SP) : ((uint32_t)MSP));

        // 提取堆栈中的寄存器值
        volatile uint32_t* r0 = (volatile uint32_t*)stacked_csr;
        volatile uint32_t* r1 = r0 + 1;
        volatile uint32_t* r2 = r0 + 2;
        volatile uint32_t* r3 = r0 + 3;
        volatile uint32_t* r12 = r0 + 4;
        volatile uint32_t* lr = r0 + 5;
        volatile uint32_t* pc = r0 + 6;
        volatile uint32_t* psr = r0 + 7;

        // 通过串口输出故障信息
        printf("HardFault!\\n");
        printf("PC: 0x%08lx\\n", (unsigned long)*pc);
        printf("LR: 0x%08lx\\n", (unsigned long)*lr);
        printf("CFSR: 0x%08lx\\n", (unsigned long)SCB->CFSR);
        printf("HFSR: 0x%08lx\\n", (unsigned long)SCB->HFSR);
        printf("BFAR: 0x%08lx\\n", (unsigned long)SCB->BFAR);
    }
}

// ============================================
// HardFault分析宏
// ============================================
#define HardFault_Analyze() do { \\
    if (SCB->CFSR & SCB_CFSR_IACCVIOL_Msk) \\
        printf("Instruction Access Violation\\n"); \\
    if (SCB->CFSR & SCB_CFSR_DACCVIOL_Msk) \\
        printf("Data Access Violation\\n"); \\
    if (SCB->CFSR & SCB_CFSR_MEMFAULTAR_Msk) \\
        printf("BusFault\\n"); \\
    if (SCB->CFSR & SCB_CFSR_DIVBYZERO_Msk) \\
        printf("Division by Zero\\n"); \\
} while(0)`,
        codeLang: 'c',
      },
    ],
  },
  {
    id: 'build-tools',
    title: '构建工具与版本控制',
    icon: 'tools',
    color: '#64748b',
    description: '掌握CMake构建系统、Git版本控制和CI/CD流水线',
    duration: '1-2周',
    modules: [
      {
        id: 'cmake-build',
        title: 'CMake构建系统',
        description: 'CMake跨平台构建、工具链配置、依赖管理和编译优化',
        topics: [
          {
            name: 'CMake基础',
            content: `CMake是跨平台构建系统生成器，通过CMakeLists.txt描述构建规则。

核心概念：
• add_executable()：定义可执行目标
• add_library()：定义库目标(STATIC/SHARED/OBJECT)
• target_include_directories()：设置头文件搜索路径
• target_link_libraries()：链接库依赖
• target_compile_options()：设置编译器选项
• target_compile_definitions()：定义预处理宏

嵌入式常用配置：
• 工具链文件：通过CMAKE_TOOLCHAIN_FILE指定ARM交叉编译器
• Flash地址：链接脚本设置程序起始地址
• 优化级别：-O2/Os平衡性能和代码大小
• 符号保留：-fdiagnostics-show-option保留调试符号`,
          },
          {
            name: 'Git版本控制',
            content: `Git是分布式版本控制系统，嵌入式项目必备技能。

核心操作：
• git init/clone：初始化/克隆仓库
• git add/commit：暂存和提交更改
• git branch/merge：分支管理和合并
• git rebase：变基操作保持线性历史
• git tag：版本标记
• git submodule：管理外部依赖

嵌入式项目最佳实践：
• .gitignore排除构建产物、IDE配置和二进制文件
• 使用.gitmodules管理CMSIS、HAL库等外部依赖
• 提交信息遵循Conventional Commits规范
• 使用CI/CD自动运行编译检查和单元测试
• 定期备份重要分支`,
          },
        ],
        resources: [
          { title: 'CMake官方文档', url: 'https://cmake.org/cmake/help/latest/', lang: 'en', type: 'doc' },
          { title: 'CMake嵌入式教程', url: 'https://github.com/nathanchance/cmake-ide/blob/main/CMakeLists.txt', lang: 'en', type: 'project' },
          { title: 'Git Pro中文版', url: 'https://git-scm.com/book/zh/v2', lang: 'zh', type: 'doc' },
        ],
        codeExample: `# CMakeLists.txt - STM32项目构建配置
cmake_minimum_required(VERSION 3.20)
project(stm32_firmware C CXX ASM)

# 设置C标准
set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)

# 包含CMake函数库
include(\$CMAKE_CURRENT_LIST_DIR/cmake/STM32.cmake)

# 定义固件版本
set(FIRMWARE_VERSION "1.0.0")

# 添加可执行目标
add_executable(firmware
    src/main.c
    src/system.c
    src/usart.c
    src/timer.c
    src/adc.c
    src/dma.c
)

# 设置包含目录
target_include_directories(firmware PRIVATE
    \${CMAKE_CURRENT_SOURCE_DIR}/Inc
    \${CMAKE_CURRENT_SOURCE_DIR}/Drivers/STM32F1xx_HAL_Driver/Inc
    \${CMAKE_CURRENT_SOURCE_DIR}/Drivers/CMSIS/Include
)

# 编译定义
target_compile_definitions(firmware PRIVATE
    USE_HAL_DRIVER
    STM32F103xB
    FIRMWARE_VERSION=\${FIRMWARE_VERSION}
)

# 编译器优化选项
target_compile_options(firmware PRIVATE
    -Os                  ;# 大小优化
    -ffunction-sections  ;# 函数分段
    -fdata-sections      ;# 数据分段
    -Wall                ;# 开启所有警告
    -Wextra
)

# 链接器选项
target_link_options(firmware PRIVATE
    -Wl,--gc-sections    ;# 丢弃未引用段
    -T \${CMAKE_CURRENT_SOURCE_DIR}/STM32F103RCTx_FLASH.ld
)

# 链接HAL库
add_subdirectory(Drivers/STM32F1xx_HAL_Driver)
target_link_libraries(firmware PRIVATE stm32cube_hal)

# 构建后生成.bin和.hex
add_custom_command(TARGET firmware POST_BUILD
    COMMAND \${CMAKE_OBJCOPY} -O binary \$<TARGET_FILE:firmware> \${CMAKE_BINARY_DIR}/firmware.bin
    COMMAND \${CMAKE_OBJCOPY} -O ihex \$<TARGET_FILE:firmware> \${CMAKE_BINARY_DIR}/firmware.hex
    COMMAND \${CMAKE_SIZEUTYPE} \$<TARGET_FILE:firmware>
    COMMENT "Generating binary and hex files"
)

# ============================================
# 工具链文件: toolchain-arm-gcc.cmake
# ============================================
set(CMAKE_SYSTEM_NAME Generic)
set(CMAKE_SYSTEM_PROCESSOR ARM)

# 交叉编译工具路径
set(TOOLCHAIN_PREFIX arm-none-eabi)
set(CMAKE_C_COMPILER \${TOOLCHAIN_PREFIX}-gcc)
set(CMAKE_CXX_COMPILER \${TOOLCHAIN_PREFIX}-g++)
set(CMAKE_ASM_COMPILER \${TOOLCHAIN_PREFIX}-gcc)
set(CMAKE_OBJCOPY \${TOOLCHAIN_PREFIX}-objcopy)
set(CMAKE_SIZEUTYPE \${TOOLCHAIN_PREFIX}-size)

# ============================================
# .gitignore 嵌入式项目推荐配置
# ============================================
# 构建产物
build/
*.o
*.bin
*.hex
*.elf

# IDE配置
.vscode/
*.swp
*.swo
.idea/
*.o/

# 系统文件
.DS_Store
Thumbs.db

# 保留重要文件
!CMakeLists.txt
!toolchain-arm-gcc.cmake`,
        codeLang: 'cmake',
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
          { title: 'FreeRTOS官方文档', url: 'https://www.freertos.org/Documentation/', lang: 'en', type: 'doc' },
          { title: 'FreeRTOS中文教程', url: 'https://www.oschina.net/question/1249040_2269142', lang: 'zh', type: 'doc' },
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
        codeExample: `#include <rtthread.h>
#include <rtdevice.h>
#include <board.h>

#define THREAD_PRIORITY      25
#define THREAD_STACK_SIZE    1024
#define THREAD_TICK          5

static struct rt_thread led_thread;
static rt_uint8_t led_thread_stack[THREAD_STACK_SIZE];
static struct rt_messagepool msg_pool;
static rt_uint8_t msg_pool_stack[512];
static struct rt_mailbox mb;
static rt_uint8_t mb_pool[16 * sizeof(rt_uint32_t)];

// LED闪烁线程
static void led_entry(void* parameter) {
    rt_pin_mode(PA8, PIN_MODE_OUTPUT);
    while (1) {
        rt_pin_write(PA8, PIN_HIGH);
        rt_thread_mdelay(300);
        rt_pin_write(PA8, PIN_LOW);
        rt_thread_mdelay(300);
    }
}

// 传感器数据采集线程
static void sensor_entry(void* parameter) {
    rt_device_t adc_dev = rt_device_find("adc1");
    rt_device_open(adc_dev, RT_DEVICE_OFLAG_RDONLY);
    
    rt_adc_channel_enable(adc_dev, RT_ADC_CHANNEL_0);
    
    while (1) {
        rt_uint32_t value = rt_adc_read(adc_dev, RT_ADC_CHANNEL_0);
        float voltage = value * 3.3f / 4095.0f;
        
        // 通过消息队列发送数据
        rt_mb_send(&mb, value);
        
        rt_kprintf("ADC: %lu, Voltage: %.2fV\\n", value, voltage);
        rt_thread_mdelay(1000);
    }
}

// FinSH命令行扩展
static int cmd_sensor_status(int argc, char** argv) {
    rt_kprintf("=== Sensor Status ===\\n");
    rt_kprintf("System uptime: %lus\\n", rt_tick_get() / RT_TICK_PER_SECOND);
    rt_kprintf("Free heap: %dB\\n", rt_malloc_max());
    return 0;
}
MSH_CMD_EXPORT(cmd_sensor_status, sensor status);

int application_init(void) {
    // 初始化消息箱
    rt_mb_init(&mb, "mb", mb_pool, sizeof(rt_uint32_t),
               sizeof(mb_pool) / sizeof(rt_uint32_t), RT_IPC_FLAG_FIFO);
    
    // 创建LED线程
    rt_thread_init(&led_thread, "led", led_entry, RT_NULL,
                   led_thread_stack, sizeof(led_thread_stack),
                   THREAD_PRIORITY, THREAD_TICK);
    rt_thread_startup(&led_thread);
    
    // 创建传感器线程
    rt_thread_t sensor = rt_thread_create("sensor", sensor_entry, RT_NULL,
                                          THREAD_STACK_SIZE,
                                          THREAD_PRIORITY + 5, THREAD_TICK);
    if (sensor) rt_thread_startup(sensor);
    
    return 0;
}
INIT_APP_EXPORT(application_init);`,
        codeLang: 'c',
      },
    ],
  },
  {
    id: 'embedded-linux',
    title: '嵌入式Linux',
    icon: 'server',
    color: '#10b981',
    description: '学习Linux内核基础、U-Boot启动流程、Device Tree、Buildroot/Yocto构建系统',
    duration: '4-8周',
    modules: [
      {
        id: 'linux-kernel-basics',
        title: 'Linux内核基础',
        description: '内核架构、进程管理、内存管理、设备驱动模型',
        topics: [
          { name: '内核架构与模块化', content: 'Linux是模块化 monolithic 内核。核心部分 monolithic，但通过可加载内核模块(LKM)提供扩展性。嵌入式中常用模块方式加载驱动，节省内存。' },
          { name: '进程管理与调度', content: 'Linux使用CFS(完全公平调度器)处理普通任务，SCHED_FIFO/SCHED_RR处理实时任务。PREEMPT_RT补丁可将Linux改造为硬实时系统。' },
          { name: '内存管理', content: '虚拟内存、分页、DMA映射、SLAB分配器。嵌入式中常用CONFIG_DEVTMPFS自动创建设备节点，CONFIG_TMPFS提供RAM磁盘。' },
          { name: '设备驱动模型', content: '字符设备、块设备、网络接口、Platform设备。驱动通过platform_bus与设备树匹配。' },
          { name: '内核编译与配置', content: 'make menuconfig配置内核选项，make zImage dtbs编译内核和设备树。关键选项：CONFIG_PREEMPT_RT、CONFIG_SQUASHFS、CONFIG_TMPFS。' },
        ],
        resources: [
          { title: 'Linux设备驱动开发详解', url: 'https://www.bilibili.com/video/BV1qJ411d7Pb', lang: 'zh', type: 'video' },
          { title: 'Linux Device Drivers, 3rd Edition', url: 'https://lwn.net/Kernel/LDD3/', lang: 'en', type: 'doc' },
        ],
        codeExample: `#include <linux/module.h>
#include <linux/init.h>
#include <linux/kernel.h>
#include <linux/fs.h>
#include <linux/cdev.h>

static int major_num = 0;
static struct cdev my_cdev;
static struct class *my_class;

static int my_open(struct inode *inode, struct file *filp) {
    printk(KERN_INFO "Device opened\\n");
    return 0;
}

static ssize_t my_read(struct file *filp, char __user *buf,
                       size_t count, loff_t *ppos) {
    char msg[] = "Hello from embedded Linux!\\n";
    if (copy_to_user(buf, msg, min(count, sizeof(msg))))
        return -EFAULT;
    return sizeof(msg);
}

static struct file_operations fops = {
    .owner = THIS_MODULE,
    .open = my_open,
    .read = my_read,
};

static int __init mydriver_init(void) {
    dev_t dev = MKDEV(major_num, 0);
    alloc_chrdev_region(&dev, 0, 1, "mydev");
    major_num = MAJOR(dev);

    cdev_init(&my_cdev, &fops);
    cdev_add(&my_cdev, dev, 1);

    my_class = class_create(THIS_MODULE, "mydev_class");
    device_create(my_class, NULL, dev, NULL, "mydev0");

    printk(KERN_INFO "My driver loaded, major=%d\\n", major_num);
    return 0;
}

static void __exit mydriver_exit(void) {
    device_destroy(my_class, MKDEV(major_num, 0));
    class_destroy(my_class);
    cdev_del(&my_cdev);
    unregister_chrdev_region(MKDEV(major_num, 0), 1);
    printk(KERN_INFO "My driver unloaded\\n");
}

module_init(mydriver_init);
module_exit(mydriver_exit);
MODULE_LICENSE("GPL");`,
        codeLang: 'c',
      },
      {
        id: 'boot-process',
        title: '启动流程 (U-Boot, DTB)',
        description: 'U-Boot bootloader、设备树(DTB)、内核启动参数、根文件系统挂载',
        topics: [
          { name: 'U-Boot Bootloader', content: 'U-Boot是最广泛使用的嵌入式Linux bootloader。启动链：ROM code -> U-Boot -> Kernel -> initramfs -> rootfs -> systemd/SysVinit。' },
          { name: '设备树(DTB)', content: 'Device Tree Blob描述硬件信息给内核，使内核硬件无关。用.dts源码编译为.dtb二进制。' },
          { name: '内核启动参数(bootargs)', content: 'console=ttyS0,115200设置串口控制台，root=/dev/mmcblk0p2指定根文件系统，rootwait等待设备就绪。' },
          { name: '根文件系统构建', content: 'BusyBox提供最小化Shell和工具集。SquashFS提供压缩只读文件系统，OverlayFS提供读写层。' },
        ],
        resources: [
          { title: 'U-Boot使用教程', url: 'https://www.bilibili.com/video/BV1qJ411d7Pb', lang: 'zh', type: 'video' },
          { title: 'Device Tree Specification', url: 'https://www.devicetree.org/specifications/', lang: 'en', type: 'doc' },
        ],
        codeExample: `# U-Boot environment variables
setenv bootcmd 'fatload mmc 0:1 0x42000000 zImage; fatload mmc 0:1 0x43000000 myboard.dtb; bootz 0x42000000 - 0x43000000'
setenv bootargs 'console=ttyS0,115200 root=/dev/mmcblk0p2 rw rootwait'
saveenv

# Device Tree example (.dts)
/ {
    model = "My Embedded Board";
    compatible = "myvendor,myboard";

    chosen {
        bootargs = "console=ttyS0,115200 root=/dev/mmcblk0p2 rw";
    };

    uart0: serial@4000c000 {
        compatible = "snps,dw-apb-uart";
        reg = <0x4000c000 0x100>;
        interrupts = <GIC_SPI 24 IRQ_TYPE_LEVEL_HIGH>;
        status = "okay";
    };

    leds {
        compatible = "gpio-leds";
        status_led {
            label = "status";
            gpios = <&gpio0 28 GPIO_ACTIVE_HIGH>;
            linux,default-trigger = "heartbeat";
        };
    };
};

# Compile device tree
dtc -I dts -O dtb -o myboard.dtb myboard.dts`,
        codeLang: 'bash',
      },
      {
        id: 'buildroot-yocto',
        title: 'Buildroot与Yocto构建系统',
        description: 'Buildroot简单构建完整嵌入式Linux，Yocto高度定制化发行版构建',
        topics: [
          { name: 'Buildroot入门', content: 'Buildroot是简单高效的嵌入式Linux构建工具，一次构建生成toolchain、kernel、bootloader和rootfs。适合简单确定性的构建。' },
          { name: 'Buildroot配置', content: 'make menuconfig配置目标架构、内核版本、包选择。make -j$(nproc)构建全部。输出在output/images/目录。' },
          { name: 'Yocto Project', content: 'Yocto使用BitBake构建引擎，支持复杂依赖解析和包管理。通过layer机制组织recipe，适合大规模定制化。' },
          { name: '交叉编译工具链', content: 'Buildroot和Yocto都生成完整的交叉编译工具链，包含gcc、binutils、glibc/musl等。' },
        ],
        resources: [
          { title: 'Buildroot官方文档', url: 'https://buildroot.org/downloads/manual/manual.html', lang: 'en', type: 'doc' },
          { title: 'Yocto Project快速入门', url: 'https://www.yoctoproject.org/docs/latest/mega-manual/mega-manual.html', lang: 'en', type: 'doc' },
        ],
        codeExample: `# Buildroot
make qemu_arm_vexpress_defconfig
make menuconfig
make -j$(nproc)
# Output: output/images/zImage, rootfs.tar.gz, sdcard.img

# Yocto
source oe-init-build-env
bitbake-layers create-layer meta-mycompany
echo 'MACHINE = "raspberrypi4-64"' > conf/local.conf
echo 'DISTRO = "poky"' >> conf/local.conf
bitbake core-image-minimal

# BusyBox configuration (in Buildroot)
# Toolchain -> External toolchain
# Target packages -> Shell and utilities -> BusyBox
# Filesystem images -> tar the root filesystem`,
        codeLang: 'bash',
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
          { title: 'MQTT Essentials - HiveMQ', url: 'https://www.hivemq.com/blog/mqtt-essentials/', lang: 'en', type: 'doc' },
          { title: 'ESP32 MQTT教程', url: 'https://randomnerdtutorials.com/?s=esp32+mqtt', lang: 'en', type: 'doc' },
        ],
        codeExample: `#include <WiFi.h>
#include <PubSubClient.h>

WiFiClient espClient;
PubSubClient mqtt(espClient);

const char* ssid = "YourWiFi";
const char* password = "YourPassword";
const char* mqtt_server = "broker.emqx.io";
const char* mqtt_user = "esp32_sensor";
const char* topic_pub = "home/sensor/data";
const char* topic_sub = "home/control/led";

// MQTT回调: 接收订阅消息
void callback(const char* topic, byte* payload, unsigned int length) {
    String msg = "";
    for (int i = 0; i < length; i++) msg += (char)payload[i];
    Serial.printf("[%s] %s\\n", topic, msg.c_str());
    if (String(topic) == topic_sub) {
        digitalWrite(LED_BUILTIN, msg == "ON" ? HIGH : LOW);
    }
}

void setup() {
    Serial.begin(115200);
    pinMode(LED_BUILTIN, OUTPUT);
    
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) delay(500);
    
    mqtt.setServer(mqtt_server, 1883);
    mqtt.setCallback(callback);
    
    while (!mqtt.connected()) {
        if (mqtt.connect("ESP32-Client", mqtt_user, "", "home/lastwill", 1, true))
            Serial.println("MQTT Connected!");
        else delay(1000);
    }
    mqtt.subscribe(topic_sub);
}

void loop() {
    mqtt.loop();
    // 每5秒发布传感器数据 (JSON格式)
    static unsigned long last = 0;
    if (millis() - last > 5000) {
        last = millis();
        char buf[128];
        snprintf(buf, sizeof(buf),
            "{\"temp\":%.1f,\"humid\":%.1f,\"light\":%d}",
            25.6f, 60.2f, analogRead(A0));
        mqtt.publish(topic_pub, buf);
        Serial.println(buf);
    }
}`,
        codeLang: 'cpp',
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
          { title: 'ESP32 BLE教程', url: 'https://randomnerdtutorials.com/?s=esp32+bluetooth', lang: 'en', type: 'doc' },
          { title: 'ESP32 OTA升级 - 乐鑫文档', url: 'https://docs.espressif.com/projects/esp-idf/zh_CN/latest/esp32/api-reference/system/ota.html', lang: 'zh', type: 'doc' },
        ],
        codeExample: `#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <Update.h>
#include <ESPmDNS.h>
#include <WiFiUdp.h>

// ============================================================
// BLE Service - 温湿度传感器模拟
// ============================================================
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

BLEServer* pServer = NULL;
BLECharacteristic* pTxChar;

class BLEServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
        Serial.println("BLE Client connected");
    }
    void onDisconnect(BLEServer* pServer) {
        Serial.println("BLE Client disconnected");
    }
};

void setupBLE() {
    BLEDevice::init("ESP32-Sensor");
    pServer = BLEDevice::createServer();
    pServer->setCallbacks(new BLEServerCallbacks());
    
    BLEService* pService = pServer->createService(SERVICE_UUID);
    pTxChar = pService->createCharacteristic(
        CHARACTERISTIC_UUID,
        BLECharacteristic::PROPERTY_NOTIFY | BLECharacteristic::PROPERTY_READ
    );
    pService->start();
    BLEDevice::startAdvertising();
}

void sendSensorData() {
    char data[32];
    snprintf(data, sizeof(data), "%.1fC %.1f%%", 25.6f, 60.2f);
    pTxChar->setValue(data);
    pTxChar->notify();
}

// ============================================================
// OTA固件升级 (mDNS + HTTP Update)
// ============================================================
void setupOTA() {
    if (MDNS.begin("esp32-ota")) {
        MDNS.addService("http", "tcp", 80);
        Serial.println("mDNS: http://esp32-ota.local");
    }
}

void handleFirmwareUpdate() {
    // HTTP POST /update 接收.bin固件
    if (Update.hasError()) {
        Serial.println("Update FAILED");
    } else {
        Serial.println("Update OK, rebooting...");
        ESP.restart();
    }
}`,
        codeLang: 'cpp',
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
        codeExample: `# ESP32 连接阿里云IoT平台 (MQTT)
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

const char* ssid = "YourWiFi";
const char* password = "YourPassword";

// 阿里云IoT三元组
const char* productKey = "a1xxxxxxxx";
const char* deviceName = "ESP32_Device";
const char* deviceSecret = "your_device_secret";

// MQTT主题
char topic_post[128];  // 属性上报
char topic_subscribe[128]; // 属性订阅

WiFiClient espClient;
PubSubClient mqtt(espClient);

// 阿里云MQTT鉴权 (简化版, 实际需计算Signature)
String getMQTTUsername() {
    return String(deviceName) + "&" + productKey;
}
String getMQTTClientID() {
    return deviceName + "|securemode=3,signmethod=hmacsha1|";
}

// 属性上报: 温度/湿度数据
void postProperties(float temp, float humid) {
    char payload[128];
    snprintf(payload, sizeof(payload),
        "{\"params\":{\"Temperature\":%.1f,\"Humidity\":%.1f},"
        "\"method\":\"thing.event.property.post\"}", temp, humid);
    mqtt.publish(topic_post, payload);
}

// 设备影子同步
void syncDeviceShadow(String status) {
    char payload[128];
    snprintf(payload, sizeof(payload),
        "{\"state\":{\"desired\":{\"led\":\"%s\"}},\"method\":\"shadow.update\"}",
        status.c_str());
    mqtt.publish("$shadow/update", payload);
}

void setup() {
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) delay(500);
    
    // 构建主题
    sprintf(topic_post, "/sys/%s/%s/thing/event/property/post",
            productKey, deviceName);
    sprintf(topic_subscribe, "/sys/%s/%s/thing/service/property/set",
            productKey, deviceName);
    
    mqtt.setServer("a1xxxxxxxx.iot-as-mqtt.cn-shanghai.aliyuncs.com", 1883);
    mqtt.setCallback([](const char* topic, byte* payload, unsigned int len) {
        // 解析云端控制命令
    });
    
    while (!mqtt.connected()) {
        mqtt.connect(getMQTTClientID().c_str(),
                     getMQTTUsername().c_str(), "");
    }
}

void loop() {
    mqtt.loop();
    static unsigned long last = 0;
    if (millis() - last > 10000) {
        last = millis();
        postProperties(25.6f, 60.2f);
    }
}`,
        codeLang: 'cpp',
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
          { title: 'IoT项目合集 - Hackster', url: 'https://www.hackster.io/search?q=iot&content_type=projects', lang: 'en', type: 'project' },
          { title: 'ESP32综合项目实战 - 极客工坊', url: 'https://www.geek-workshop.com/forum.php?mod=forumdisplay&fid=84', lang: 'zh', type: 'project' },
        ],
        codeExample: `# ESP32智能家居灯控系统 - 完整项目框架
#include <WiFi.h>
#include <PubSubClient.h>
#include <ESPmDNS.h>
#include <DHT.h>
#include <Wire.h>
#include <Adafruit_SSD1306.h>

// ============================================================
// 硬件定义
// ============================================================
#define DHT_PIN      4
#define RELAY_PIN_1  16  // 主灯继电器
#define RELAY_PIN_2  17  // 氛围灯继电器
#define DIMMER_PIN   25  // PWM调光输出
#define DHT_TYPE     DHT22

DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_SSD1306 display(-1, 4); // I2C OLED

// ============================================================
// MQTT + 本地Web控制
// ============================================================
const char* ssid = "HomeWiFi";
const char* password = "wifi_password";
PubSubClient mqtt(WiFiClient());

void callback(const char* topic, byte* payload, unsigned int len) {
    String msg = "";
    for (int i = 0; i < len; i++) msg += (char)payload[i];
    
    if (String(topic) == "home/light/set") {
        if (msg == "ON") {
            digitalWrite(RELAY_PIN_1, HIGH);
            analogWrite(DIMMER_PIN, 255);
        } else {
            digitalWrite(RELAY_PIN_1, LOW);
            analogWrite(DIMMER_PIN, 0);
        }
    }
}

// ============================================================
// 本地Web服务器 (断网时可用)
// ============================================================
#include <WebServer.h>
WebServer server(80);

void handleControl() {
    String json = "{";
    json += "\"temp\":" + String(dht.readTemperature(), 1);
    json += ",\"humid\":" + String(dht.readHumidity(), 1);
    json += ",\"led\":" + String(digitalRead(RELAY_PIN_1));
    json += "}";
    server.send(200, "application/json", json);
}

void handleSetLED() {
    String state = server.arg("state");
    digitalWrite(RELAY_PIN_1, state == "ON" ? HIGH : LOW);
    server.send(200, "text/plain", "OK");
    // 同步到MQTT
    mqtt.publish("home/light/set", state.c_str());
}

void setup() {
    Serial.begin(115200);
    dht.begin();
    
    pinMode(RELAY_PIN_1, OUTPUT);
    pinMode(RELAY_PIN_2, OUTPUT);
    ledcSetup(0, 5000, 8); // 5kHz PWM
    ledcAttachPin(DIMMER_PIN, 0);
    
    // I2C OLED初始化
    Wire.begin(21, 22); // SDA=21, SCL=22
    display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    
    // WiFi连接
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) delay(500);
    Serial.println("\\nIP: " + WiFi.localIP().toString());
    
    // mDNS: http://smartlight.local
    MDNS.begin("smartlight");
    
    // MQTT连接
    mqtt.setServer("192.168.1.100", 1883);
    mqtt.setCallback(callback);
    while (!mqtt.connected())
        mqtt.connect("SmartLight");
    mqtt.subscribe("home/light/set");
    
    // Web路由
    server.on("/api/status", handleControl);
    server.on("/api/led", handleSetLED);
    server.begin();
    
    display.println("Smart Light");
    display.println("Ready!");
    display.display();
}

void loop() {
    mqtt.loop();
    server.handleClient();
    
    static unsigned long last = 0;
    if (millis() - last > 5000) {
        last = millis();
        float t = dht.readTemperature();
        float h = dht.readHumidity();
        
        // OLED显示
        display.clearDisplay();
        display.setCursor(0, 0);
        display.printf("T: %.1fC\\nH: %.1f%%\\n", t, h);
        display.printf("LED: %s\\n", digitalRead(RELAY_PIN_1) ? "ON" : "OFF");
        display.display();
        
        // MQTT上报
        char buf[128];
        snprintf(buf, sizeof(buf), "{\"temp\":%.1f,\"humid\":%.1f}", t, h);
        mqtt.publish("home/light/data", buf);
    }
}`,
        codeLang: 'cpp',
      },
    ],
  },
  {
    id: 'low-power',
    title: '低功耗设计',
    icon: 'battery',
    color: '#16a34a',
    description: '休眠模式、时钟树优化、动态电压频率调节和功耗测量',
    duration: '1-2周',
    modules: [
      {
        id: 'power-management',
        title: '电源管理与功耗优化',
        description: 'MCU低功耗模式、时钟优化和功耗测量技术',
        topics: [
          {
            name: 'STM32低功耗模式',
            content: `STM32系列MCU提供多种低功耗模式：

Sleep模式：
• CPU内核停止，外设继续运行
• 进入：WFI(Wait For Interrupt)或WFE(Wait For Event)
• 唤醒：任何中断
• 典型电流：约20-30mA(取决于运行外设)

Stop模式：
• 1.8V域全部关闭(HSI/HSE振荡器停止)
• 备份区域(RTC、LSI、LSE、后备SRAM)保持供电
• Stop 0：保留电压调节器，唤醒快
• Stop 1：降低电压调节器，功耗更低
• 唤醒：EXTI中断、RTC闹钟
• 典型电流：Stop0约150uA，Stop1约20uA

Standby模式：
• 最低功耗模式，仅保留备份区域
• SRAM内容丢失，寄存器复位
• 唤醒：Wakeup引脚、RTC闹钟、IWDG
• 典型电流：约2-5uA

Low Run模式：
• 内核降频运行，降低动态功耗
• 适合间歇性任务处理`,
          },
          {
            name: '时钟树优化',
            content: `时钟是嵌入式系统功耗的主要来源。

时钟优化策略：
• 使用最低必要频率：任务完成后降低时钟频率
• 关闭未用外设时钟：通过RCC_APBxENR寄存器控制
• 选择合适时钟源：低频任务使用LSI/LSE
• 时钟树分域控制：不同外设域独立时钟管理

STM32时钟源选择：
• HSE：外部高速晶振，高精度
• HSI：内部RC振荡器，启动快
• LSE：外部低速晶振(32.768kHz)，RTC用
• LSI：内部低速RC，IWDG用
• PLL：倍频器，生成高速时钟

动态时钟调节：
• 根据负载动态调整PLL倍频系数
• Flash等待周期随频率变化
• 电压调节器模式随频率调整`,
          },
          {
            name: '功耗测量与优化实战',
            content: `功耗测量方法：

硬件测量：
• 串联电流表：简单但影响电路
• 电流探头+示波器：非侵入式测量
• 专用功耗分析仪：Nordic Power Profiler Kit 2

软件估算：
• 基于模式时间占比估算总功耗
• 电池寿命 = 电池容量 / 平均电流

电池寿命计算示例：
• 工作模式：20mA × 10ms = 0.2mAs
• 休眠模式：20uA × 10s = 200mAs
• 平均电流 = (0.2 + 200) / 10.01 ≈ 20uA
• 使用CR2032(220mAh)：220mAh / 20uA = 11000小时 ≈ 1.25年

优化技巧：
• 外设使用后及时关闭
• DMA传输减少CPU参与
• 使用低功耗定时器唤醒
• 优化唤醒频率和数据处理时间
• 选择合适电池类型和容量`,
          },
        ],
        resources: [
          { title: 'STM32低功耗参考手册', url: 'https://www.st.com/resource/en/reference_manual/dm00031020.pdf', lang: 'en', type: 'doc' },
          { title: 'Nordic功耗优化指南', url: 'https://devzone.nordicsemi.com/f/nordic-q-a/48215/power-profiling-and-optimization', lang: 'en', type: 'doc' },
          { title: '低功耗设计教程', url: 'https://www.bilibili.com/video/BV1cY411d7XB', lang: 'zh', type: 'video' },
        ],
        codeExample: `// ============================================
// STM32低功耗模式配置示例
// ============================================
#include "stm32f1xx_hal.h"

// ============================================
// Stop模式 - 最低功耗待机
// ============================================
void Enter_Stop_Mode(void) {
    // 1. 关闭所有不需要的时钟
    __HAL_RCC_GPIOA_CLK_DISABLE();
    __HAL_RCC_GPIOB_CLK_DISABLE();
    __HAL_RCC_GPIOC_CLK_DISABLE();
    __HAL_RCC_ADC1_CLK_DISABLE();
    __HAL_RCC_TIM2_CLK_DISABLE();

    // 2. 配置唤醒引脚 (PA0上升沿唤醒)
    GPIO_InitTypeDef GPIO_InitStruct = {0};
    __HAL_RCC_GPIOA_CLK_ENABLE();
    GPIO_InitStruct.Pin = GPIO_PIN_0;
    GPIO_InitStruct.Mode = GPIO_MODE_IT_RISING;
    GPIO_InitStruct.Pull = GPIO_PULLDOWN;
    HAL_GPIO_Init(GPIOA, &GPIO_InitStruct);
    HAL_NVIC_SetPriority(GPIOA0_IRQn, 0, 0);
    HAL_NVIC_EnableIRQ(GPIOA0_IRQn);

    // 3. 关闭未用外设
    HAL_SuspendTick();  // 暂停SysTick

    // 4. 使能电源时钟
    __HAL_RCC_PWR_CLK_ENABLE();

    // 5. 进入Stop模式 (WFI)
    HAL_PWR_EnterSTOPMode(PWR_LOWPOWERREGULATOR_ON, PWR_STOPENTRY_WFI);

    // === 唤醒后从这里继续执行 ===

    // 6. 重新配置系统时钟
    SystemClock_Config();

    // 7. 恢复SysTick
    HAL_ResumeTick();
}

// ============================================
// Standby模式 - 最低功耗
// ============================================
void Enter_Standby_Mode(void) {
    // 配置唤醒源
    __HAL_RCC_PWR_CLK_ENABLE();
    HAL_PWR_EnableWakeUpPin(PWR_WAKEUP_PIN1);  // PA0

    // 清除唤醒标志
    __HAL_PWR_CLEAR_FLAG(PWR_FLAG_WU);

    // 进入Standby模式
    HAL_PWR_EnterSTANDBYMode();
    // 此函数不会返回，唤醒后系统复位
}

// ============================================
// RTC唤醒定时唤醒
// ============================================
RTC_HandleTypeDef hrtc;

void RTC_Wakeup_Init(void) {
    hrtc.Instance = RTC;
    hrtc.Init.HourFormat = RTC_HOURFORMAT_24;
    hrtc.Init.AsynchPrediv = 127;
    hrtc.Init.SynchPrediv = 255;
    HAL_RTC_Init(&hrtc);

    // 配置WakeUp定时器: 每1秒唤醒
    HAL_RTCEx_SetWakeUpTimer(&hrtc, 0x7FF, RTC_WAKEUPCLOCK_CK_SPRE_16BITS);
    HAL_RTCEx_SetWakeUpTimer_IT(&hrtc, 0x7FF, RTC_WAKEUPCLOCK_CK_SPRE_16BITS);
    HAL_NVIC_SetPriority(RTC_WKUP_IRQn, 0, 0);
    HAL_NVIC_EnableIRQ(RTC_WKUP_IRQn);
}

// RTC唤醒中断处理
void RTC_WKUP_IRQHandler(void) {
    HAL_RTCEx_WakeUpTimerIRQHandler(&hrtc);
}

void HAL_RTCEx_WakeUpTimerEventCallback(RTC_HandleTypeDef *hrtc) {
    // 清除唤醒标志
    __HAL_RTC_WAKEUPTIMER_CLEAR_FLAG(hrtc, RTC_FLAG_WUTF);

    // 执行唤醒后任务
    ReadSensorData();
    SendDataViaLoRa();

    // 再次进入低功耗模式
    Enter_Stop_Mode();
}

// ============================================
// 功耗估算工具函数
// ============================================
typedef struct {
    float current_mA;   // 模式电流(mA)
    float duration_ms;  // 持续时间(ms)
    char name[32];
} PowerMode_t;

float CalculateAvgCurrent(PowerMode_t* modes, uint8_t numModes) {
    float totalCharge = 0;  // 总电荷量(mAs)
    float totalDuration = 0;

    for (uint8_t i = 0; i < numModes; i++) {
        totalCharge += modes[i].current_mA * modes[i].duration_ms;
        totalDuration += modes[i].duration_ms;
    }

    return totalCharge / totalDuration;  // 平均电流(mA)
}

float CalculateBatteryLife(float batteryCapacity_mAh, float avgCurrent_mA) {
    return (batteryCapacity_mAh * 1000.0f) / avgCurrent_mA;  // 小时数
}`,
        codeLang: 'c',
      },
    ],
  },
  {
    id: 'security',
    title: '嵌入式安全',
    icon: 'shield',
    color: '#dc2626',
    description: '固件安全、加密算法、安全启动和攻击防护',
    duration: '2-3周',
    modules: [
      {
        id: 'security-fundamentals',
        title: '安全基础与威胁模型',
        description: '嵌入式安全威胁、攻击面和防护策略',
        topics: [
          {
            name: '安全威胁模型',
            content: `嵌入式系统面临的安全威胁包括：

物理攻击：
• 侧信道分析：功耗分析(SPA/DPA)、电磁分析(EMA)、时序分析
• 故障注入：电压毛刺、时钟 glitch、激光注入
• 探针攻击：直接连接调试接口、总线探针

软件攻击：
• 固件提取：通过SPI/UART/JTAG读取Flash内容
• 缓冲区溢出：栈溢出、堆溢出、格式化字符串漏洞
• 重放攻击：捕获并重放通信数据
• 中间人攻击：篡改通信数据

供应链攻击：
• 恶意组件：第三方库漏洞、硬件木马
• 固件篡改：分发渠道被劫持
• 依赖污染：npm/cargo/pip依赖注入

防护策略：
• 纵深防御：多层安全机制
• 最小权限原则：仅开放必要功能
• 安全开发生命周期：威胁建模、代码审查、渗透测试`,
          },
          {
            name: '加密算法应用',
            content: `嵌入式系统常用加密算法：

对称加密：
• AES-128/256：最常用，支持硬件加速
• ChaCha20：软件实现高效，无S盒侧信道风险
• DES/3DES：已不推荐使用

非对称加密：
• RSA-2048/4096：密钥交换、数字签名
• ECC-256：椭圆曲线，密钥更短性能更好
• Ed25519：EdDSA签名算法，快速安全

哈希算法：
• SHA-256：消息摘要、密钥派生
• SHA-3：Keccak算法，抗碰撞
• CRC32：错误检测，非加密用途

密钥管理：
• 密钥存储：OTP区域、安全元件、TrustZone
• 密钥派生：PBKDF2、HKDF、Argon2
• 密钥轮换：定期更换密钥`,
          },
          {
            name: '安全启动与固件更新',
            content: `安全启动(Secure Boot)确保只有可信固件才能运行。

启动链验证：
• Bootrom：ROM中固化，验证Bootloader签名
• Bootloader：验证应用固件签名
• Application：验证关键数据完整性

数字签名方案：
• RSA-PSS：概率签名方案
• ECDSA：椭圆曲线签名
• Ed25519：快速签名验证

安全固件更新(OTA)：
• A/B分区：双分区无缝更新
• 签名验证：更新前验证固件签名
• 回滚保护：防止降级到旧版本固件
• 原子更新：更新失败自动回滚

STM32安全特性：
• RDP(Readout Protection)：Flash读取保护
• BKR(Bit Key Register)：用户密钥存储
• UID：唯一设备标识符
• True RNG：硬件真随机数生成器`,
          },
        ],
        resources: [
          { title: 'ARM TrustZone安全架构', url: 'https://developer.arm.com/technologies/trustzone', lang: 'en', type: 'doc' },
          { title: '嵌入式安全最佳实践 - NXP', url: 'https://www.nxp.com/doc/APPNOTE/APN2065', lang: 'en', type: 'doc' },
          { title: 'STM32安全功能参考', url: 'https://www.st.com/content/st_com/en/products/ecosystems/stm32-ecoscene/stm32-security.html', lang: 'en', type: 'doc' },
        ],
        codeExample: `// ============================================
// AES-128-CBC加密示例 (使用STM32硬件加密)
// ============================================
#include "stm32f4xx_hal.h"

CRYP_HandleTypeDef hcryp;

void AES_Init(void) {
    hcryp.Instance = CRYP;
    hcryp.Init.DataType = CRYP_DATATYPE_32B;
    hcryp.Init.KeySize = CRYP_KEYSIZE_128B;
    hcryp.Init.Algorithm = CRYP_AES_CBC;
    hcryp.Init.DataWidth = CRYP_DATAW_32B;
    HAL_CRYP_Init(&hcryp);

    // 设置AES密钥 (16字节 = 128位)
    uint32_t key[4] = {
        0x2B7E1516, 0x28AED2A6,
        0xABF71588, 0x09CF4F3C
    };
    HAL_CRYPEx_SetKey(&hcryp, CRYP_KEYSIZE_128B, key);

    // 设置初始向量IV
    uint32_t iv[4] = {
        0x00010203, 0x04050607,
        0x08090A0B, 0x0C0D0E0F
    };
    HAL_CRYPEx_SetIV(&hcryp, iv);
}

// 加密数据
uint8_t encrypted[16];
uint8_t plaintext[16] = "Hello EmbedKit!";

void AES_Encrypt(void) {
    HAL_CRYP_Encrypt(&hcryp,
                     (uint32_t*)plaintext,
                     (uint32_t*)encrypted,
                     16,
                     1000);  // 超时1秒
}

// ============================================
// 固件签名验证 (使用CRC和简单校验)
// ============================================
#define FIRMWARE_SIGNATURE_ADDR  0x08000000
#define FIRMWARE_CRC_ADDR        0x0807FFFC

uint32_t CalcCRC32(const uint8_t* data, uint32_t len) {
    uint32_t crc = 0xFFFFFFFF;
    for (uint32_t i = 0; i < len; i++) {
        crc ^= data[i];
        for (int j = 0; j < 8; j++) {
            crc = (crc >> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
        }
    }
    return ~crc;
}

// 验证固件完整性
bool VerifyFirmware(void) {
    uint32_t storedCRC = *(volatile uint32_t*)FIRMWARE_CRC_ADDR;
    // 计算除CRC区域外的固件CRC
    uint32_t calcCRC = CalcCRC32(
        (const uint8_t*)FIRMWARE_SIGNATURE_ADDR,
        0x7FFFC  // Flash大小 - CRC偏移
    );
    return (storedCRC == calcCRC);
}

// ============================================
// STM32 Flash读取保护配置
// ============================================
void EnableFlashProtection(void) {
    HAL_FLASH_Unlock();

    // 设置RDP Level 1: 禁止Flash和SRAM读取
    HAL_FLASH_OB_Unlock();
    HAL_FLASHEx_OBGetConfig();

    // 注意: RDP降级后无法恢复，需谨慎操作
    // HAL_FLASH_OB_Launch();
}`,
        codeLang: 'c',
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
          { title: 'AD官方教程', url: 'https://www.altium.com/learn', lang: 'en', type: 'doc' },
        ],
        codeExample: `; Altium Designer PCB规则脚本示例
; 用于自动化PCB设计规则检查 (DesignRule脚本)

// 1. 线宽规则: 电源/信号/差分对
// Power Net: 20mil (1A电流承载)
// Signal Net: 6mil (常规信号)
// Differential Pair: 5mil (90欧姆阻抗)

// 2. 过孔规则
// Power Via: 焊盘0.8mm/孔0.4mm
// Signal Via: 焊盘0.6mm/孔0.3mm
// Micro Via: 焊盘0.3mm/孔0.1mm (HDI板)

// 3. 间距规则
// Signal-Signal: 6mil (常规)
// Signal-Power: 10mil
// Power-Power: 10mil
// High-Speed: 3W规则 (线宽+间距 >= 3倍线宽)

; KiCad脚本示例 - 批量生成BOM
; 文件: generate_bom.py
import pcbnew
import csv

board = pcbnew.LoadBoard("stm32_minimum_system.kicad_pcb")

# 按参考号整理元器件
components = {}
for module in board.GetFootprints():
    ref = module.GetReference()
    val = module.GetValue()
    fp = module.GetFPID().GetFootprintName()
    if ref not in components:
        components[ref] = {'value': val, 'footprint': fp, 'qty': 1}
    else:
        components[ref]['qty'] += 1

# 输出CSV BOM
with open('bom.csv', 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['Ref', 'Value', 'Footprint', 'Qty'])
    for ref in sorted(components.keys()):
        c = components[ref]
        writer.writerow([ref, c['value'], c['footprint'], c['qty']])

print("BOM generated: bom.csv")`,
        codeLang: 'python',
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
           { title: 'PCB EMC Design Guidelines - TI', url: 'https://www.ti.com/lit/pdf/spra997', lang: 'en', type: 'doc' },
        ],
        codeExample: `; Altium Designer - PCB布线关键规则配置
; 对应 Design Rule 设置

// === 1. 差分对布线规则 (USB_D+/D-) ===
// Width: 25mil (阻抗90欧姆, FR4, 外层)
// Spacing: 15mil
// Length Matching: ±5mil ( skew < 0.2ns )

// === 2. 阻抗控制计算 (FR4板材) ===
// 微带线阻抗公式 (外层):
// Zo = (87/sqrt(Er+1.4)) * ln(5.98h/(0.8w+t))
// 例: Er=4.4, h=0.2mm(铜厚), w=0.3mm -> Zo ≈ 50欧姆

// === 3. 电源完整性: 去耦电容布局 ===
// 规则: 每个VDD引脚放置0.1uF陶瓷电容
// 过孔: 电容到VDD和GND各自打过孔, 最短回路
// 大电容(10uF) + 小电容(0.1uF)并联处理不同频段噪声

// === 4. EMC设计要点 ===
// (1) 4层板推荐叠层: Signal / GND / Power / Signal
// (2) 所有信号线必须有参考平面(避免跨分割)
// (3) 时钟线走内层, 两侧用地线保护
// (4) IO端口加TVS管或共模电感
// (5) 连接器外壳接地, 外壳连续360度包地

// === 5. Gerber输出设置 (生产文件) ===
// Layer Output:
//   TopLayer -> GTL.gtl
//   TopPaste -> GTP.gtp
//   TopSilk -> GTS.gts
//   BottomLayer -> GBL.gbl
//   BottomSilk -> GBS.gbs
//   GND_Plane -> G1.pln
//   PWR_Plane -> G2.pln
//   Drill Drawing -> EXCEL.xlsx (钻孔表)
//   Drill File -> NC drill (.drl)
//   Assembly Drawing -> GKO.gko

// === KiCad自动生成生产文件脚本 ===
import pcbnew

board = pcbnew.LoadBoard("smart_device.kicad_pcb")
plot_dir = "production_files/"

# Gerber设置
plotter = pcbnew.PlotterBoard()
plotter.SetOutputDirectory(plot_dir)
popts = plotter.GetPlotOptions()
popts.SetPlotFrameRef(False)
popts.SetUseAuxOrigin(True)

# 需要绘制的层
layers_to_plot = [
    (pcbnew.F_Cu, "Top"),
    (pcbnew.B_Cu, "Bottom"),
    (pcbnew.F_SilkS, "SilkTop"),
    (pcbnew.F_Mask, "MaskTop"),
    (pcbnew.B_Mask, "MaskBottom"),
]

for layer, name in layers_to_plot:
    plotter.PlotLayer(layer, f"{name}.gerber")

# 钻孔文件
drillfile = pcbnew.ExcellonWriter(plotter)
drillfile.SetMapFileFormat(pcbnew.FR_FORMAT_DECIMAL)
drillfile.CreateDrillandMapFilesSet(plot_dir + "drill.drl")

print(f"Production files generated in {plot_dir}")`,
        codeLang: 'python',
      },
    ],
 },
  {
    id: 'edge-ai',
    title: '边缘AI / TinyML',
    icon: 'brain',
    color: '#8b5cf6',
    description: 'TensorFlow Lite Micro、模型量化、传感器ML流水线、MCU端推理部署',
    duration: '4-6周',
    modules: [
      {
        id: 'tflite-micro',
        title: 'TensorFlow Lite Micro',
        description: '将ML推理带到KB级内存的微控制器，支持ARM Cortex-M、RISC-V等平台',
        topics: [
          { name: 'TFLite Micro简介', content: 'TensorFlow Lite Micro是TFLite的微控制器版本，能在KB级SRAM上运行模型推理。支持ARM Cortex-M3/M4/M7/M55、RISC-V ESP32-C3等。' },
          { name: '模型量化', content: '量化用低精度表示减少模型体积并提升推理速度。后训练量化无需重新训练，全整数量化(int8)无需浮点硬件。' },
          { name: 'Tensor Arena内存管理', content: 'TFLite Micro使用预先分配的stack内存(tensor arena)来存储所有tensor，避免动态内存分配，适合嵌入式环境。' },
        ],
        resources: [
          { title: 'TensorFlow Lite Micro官方文档', url: 'https://www.tensorflow.org/lite/microcontrollers', lang: 'en', type: 'doc' },
          { title: 'TinyML书籍', url: 'https://tinyml.org/', lang: 'en', type: 'doc' },
        ],
        codeExample: `#include "tensorflow/lite/micro/micro_mutable_op_resolver.h"
#include "tensorflow/lite/micro/micro_interpreter.h"

// Register operations
tflite::MicroMutableOpResolver<2> micro_op_resolver;
micro_op_resolver.AddConv2D();
micro_op_resolver.AddAveragePool2D();

// Allocate tensor arena (stack memory for TFLite)
constexpr int tensor_arena_size = 2 * 1024;
uint8_t tensor_arena[tensor_arena_size];

// Create interpreter
tflite::MicroInterpreter interpreter(
    g_model, micro_op_resolver, tensor_arena,
    tensor_arena_size, error_reporter);
interpreter.AllocateTensors();

// Run inference
TfLiteStatus status = interpreter.Invoke();
if (status != kTfLiteOk) {
    ErrorReporter::Report("Inference failed!");
}

// Get output
TfLiteTensor* output = interpreter.output(0);
float result = output->data.f[0];`,
        codeLang: 'c',
      },
      {
        id: 'model-quantization',
        title: '模型量化与转换',
        description: '后训练量化、量化感知训练、全整数量化，将模型转换为MCU可用的格式',
        topics: [
          { name: '后训练量化', content: '无需重新训练，直接将float32模型转换为int8，约4倍体积缩减。精度损失通常可接受。' },
          { name: '量化感知训练(QAT)', content: '训练时模拟量化过程，得到更好的量化后精度。适合对精度要求高的场景。' },
          { name: '全整数量化', content: '所有运算使用int8，输入输出也量化。MCU无需FPU即可运行，速度和功耗最优。' },
        ],
        resources: [
          { title: 'TensorFlow量化指南', url: 'https://www.tensorflow.org/lite/performance/post_training_quantization', lang: 'en', type: 'doc' },
        ],
        codeExample: `import tensorflow as tf

# Load trained model
model = tf.keras.models.load_model('my_model.h5')

# Convert to TFLite with quantization
converter = tf.lite.TFLiteConverter.from_keras_model(model)
converter.optimizations = [tf.lite.Optimize.DEFAULT]

# Full integer quantization for MCUs
def repr_dataset_gen():
    for _ in range(100):
        yield [np.random.randn(1, 32).astype(np.float32)]

converter.representative_dataset = repr_dataset_gen
converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILT_INT8]
converter.inference_input_type = tf.int8
converter.inference_output_type = tf.int8

tflite_model = converter.convert()

with open('model_int8.tflite', 'wb') as f:
    f.write(tflite_model)`,
        codeLang: 'python',
      },
      {
        id: 'sensor-ml-pipeline',
        title: '传感器ML流水线',
        description: '传感器数据采集、特征提取、MCU端推理、异常检测完整流水线',
        topics: [
          { name: '端侧特征提取', content: '在MCU上直接从传感器数据提取特征：时域特征(均值、RMS、方差)、频域特征(FFT幅度带、频谱质心)。' },
          { name: '端侧推理流水线', content: '完整流水线：传感器采集 -> 特征提取 -> 模型推理 -> 阈值判决。保持推理延迟小于采样周期。' },
          { name: '功耗优化', content: '在推理周期之间使用MCU休眠模式，降低平均功耗。选择适合电池供电的应用场景。' },
        ],
        resources: [
          { title: 'Edge Impulse教程', url: 'https://docs.edgeimpulse.com/', lang: 'en', type: 'doc' },
        ],
        codeExample: `// Complete inference pipeline for anomaly detection
typedef struct {
    float raw_accel[128];
    float features[32];
    float model_output;
    bool anomaly_detected;
} InferenceResult;

InferenceResult run_inference_cycle(void) {
    InferenceResult result;

    // 1. Acquire sensor data
    read_accel_frame(result.raw_accel, 128);

    // 2. Extract features (FFT magnitude bands)
    extract_features(result.raw_accel, result.features);

    // 3. Run TFLite Micro model
    interpreter.Invoke();

    // 4. Get prediction
    TfLiteTensor* output = interpreter.output(0);
    result.model_output = output->data.f[0];

    // 5. Threshold decision
    result.anomaly_detected = (result.model_output > 0.5f);
    return result;
}

// Main loop - 50 Hz inference
int main(void) {
    while (1) {
        InferenceResult result = run_inference_cycle();
        if (result.anomaly_detected) {
            trigger_alert();  // LED, buzzer, or transmit
        }
        delay_ms(20);  // 50 Hz cycle
    }
}`,
        codeLang: 'c',
      },
    ],
  },
];
