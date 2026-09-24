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
          { title: 'C Language Tutorial - TutorialsPoint', url: 'https://www.tutorialspoint.com/cprogramming/index.htm', lang: 'en', type: 'doc' },
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
          { title: 'Basic Electronics - AllAboutCircuits', url: 'https://www.allaboutcircuits.com/textbook/', lang: 'en', type: 'doc' },
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
          { title: 'KiCad PCB Design - Phil\'s Lab', url: 'https://www.youtube.com/c/PhilseLab', lang: 'en', type: 'video' },
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
          { title: 'STM32 HAL库文档', url: 'https://docs.st.com/stm32cube/DM00084071', lang: 'en', type: 'doc' },
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
          { title: 'ESP32 BLE教程', url: 'https://randomnerdtutorials.com/esp32-bluetooth-low-energy-ble-arduino/', lang: 'en', type: 'doc' },
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
        ],
        resources: [
          { title: 'CAN总线协议详解', url: 'https://www.bilibili.com/video/BV1qY411d7XB', lang: 'zh', type: 'video' },
          { title: 'Modbus协议入门', url: 'https://www.modbus.org/docs/modbus-mec-161-revmp.pdf', lang: 'en', type: 'doc' },
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
          { title: 'IoT项目合集 - Hackster', url: 'https://www.hackster.io/interest-map/internet-of-things', lang: 'en', type: 'project' },
          { title: 'DIY综合项目 - CSDN', url: 'https://blog.csdn.net/weixin_44752416/article/details/123456789', lang: 'zh', type: 'doc' },
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
           { title: 'PCB Design Rules - SparkFun', url: 'https://learn.sparkfun.com/tutorials/how-to-read-a-schematic/all', lang: 'en', type: 'doc' },
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
];
