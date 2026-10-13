export interface HardFaultInput { r0: number; r1: number; r2: number; r3: number; r12: number; lr: number; pc: number; xpsr: number; cfsr: number; hfsr: number; mmfar?: number; bfar?: number }
export interface FaultFinding { register: 'CFSR' | 'HFSR'; bit: number; code: string; detail: string; action: string }
export interface HardFaultAnalysis { findings: FaultFinding[]; addresses: Array<{ kind: 'PC' | 'LR' | 'MMFAR' | 'BFAR'; value: number; sourceReady: boolean }>; summary: string; warnings: string[] }
export type HardFaultRegisterName = keyof HardFaultInput;
export interface ExtractedHardFaultLog { registers: Partial<Record<HardFaultRegisterName, number>>; evidence: Array<{ register: HardFaultRegisterName; value: number; line: number; text: string }>; missing: HardFaultRegisterName[]; unmatchedLines: number; warnings: string[]; confidence: 'high' | 'medium' | 'low' }

const registerNames: HardFaultRegisterName[] = ['r0', 'r1', 'r2', 'r3', 'r12', 'lr', 'pc', 'xpsr', 'cfsr', 'hfsr', 'mmfar', 'bfar'];
const requiredEvidence: HardFaultRegisterName[] = ['lr', 'pc', 'xpsr', 'cfsr', 'hfsr'];

function normalizedLogRegister(value: string): HardFaultRegisterName | null {
  const normalized = value.toLowerCase().replace(/^(?:stacked|fault)[_-]/, '').replace(/^scb(?:->|[._-])/, '');
  return registerNames.includes(normalized as HardFaultRegisterName) ? normalized as HardFaultRegisterName : null;
}

export function extractHardFaultLog(source: string): ExtractedHardFaultLog {
  if (source.length > 1024 * 1024) throw new Error('故障日志超过 1 MiB 上限');
  const registers: ExtractedHardFaultLog['registers'] = {}, evidence: ExtractedHardFaultLog['evidence'] = [], warnings: string[] = [];
  let unmatchedLines = 0;
  source.split(/\r?\n/).forEach((text, index) => {
    const expression = /\b((?:(?:stacked|fault)[_-])?(?:r0|r1|r2|r3|r12|lr|pc|xpsr)|(?:scb(?:->|[._-]))?(?:cfsr|hfsr|mmfar|bfar))\b\s*(?:=|:)?\s*(?:0x)?([0-9a-f]{1,8})\b/gi;
    let matched = false, item: RegExpExecArray | null;
    while ((item = expression.exec(text)) !== null) {
      const register = normalizedLogRegister(item[1]); if (!register) continue;
      const value = Number.parseInt(item[2], 16) >>> 0, previous = registers[register]; matched = true;
      evidence.push({ register, value, line: index + 1, text: text.trim() });
      if (previous !== undefined && previous !== value) warnings.push(`${register.toUpperCase()} 在日志中出现不同值，采用最后一处（第 ${index + 1} 行）`);
      registers[register] = value;
    }
    if (text.trim() && !matched) unmatchedLines += 1;
  });
  if (!evidence.length) throw new Error('未识别到 Cortex-M 寄存器；请粘贴包含 PC/LR/xPSR/CFSR 等名称和值的文本日志');
  const missing = registerNames.filter(name => registers[name] === undefined), coreCount = requiredEvidence.filter(name => registers[name] !== undefined).length;
  return { registers, evidence, missing, unmatchedLines, warnings, confidence: coreCount >= 4 && registers.pc !== undefined ? 'high' : registers.pc !== undefined && registers.lr !== undefined ? 'medium' : 'low' };
}

const cfsrRules: Array<[number, string, string, string]> = [
  [0, 'IACCVIOL', '取指访问违反 MPU 权限', '检查 PC 所在存储区、MPU 和函数指针'], [1, 'DACCVIOL', '数据访问违反 MPU 权限', '检查访问地址、MPU 区域和指针边界'], [3, 'MUNSTKERR', '异常返回出栈时发生 MemManage fault', '检查栈指针、栈溢出和 MPU 栈区域'], [4, 'MSTKERR', '异常入栈时发生 MemManage fault', '检查异常前栈空间和栈地址有效性'], [7, 'MMARVALID', 'MMFAR 保存了有效故障地址', '结合 MMFAR 定位非法内存访问'],
  [8, 'IBUSERR', '取指总线错误', '检查 PC、代码存储器和总线映射'], [9, 'PRECISERR', '精确数据总线错误', '结合 BFAR 和 PC 定位触发指令'], [10, 'IMPRECISERR', '非精确数据总线错误', '检查此前的缓冲写、DMA 和外设访问'], [11, 'UNSTKERR', '异常返回出栈总线错误', '检查栈损坏和异常返回流程'], [12, 'STKERR', '异常入栈总线错误', '检查栈溢出和栈存储区'], [15, 'BFARVALID', 'BFAR 保存了有效故障地址', '结合 BFAR 定位总线访问'],
  [16, 'UNDEFINSTR', '执行了未定义指令', '检查 PC 附近反汇编、代码损坏和指令集状态'], [17, 'INVSTATE', 'EPSR 状态非法', '检查跳转地址最低位和异常返回值'], [18, 'INVPC', '异常返回 PC/EXC_RETURN 非法', '检查 LR、堆栈帧和异常处理代码'], [19, 'NOCP', '访问了未启用的协处理器', '检查 FPU 配置、编译选项和 CPACR'], [24, 'UNALIGNED', '发生未对齐访问 UsageFault', '检查结构体打包、指针转换和 UNALIGN_TRP'], [25, 'DIVBYZERO', '发生除零 UsageFault', '检查除数和 DIV_0_TRP'],
];
const hfsrRules: Array<[number, string, string, string]> = [[1, 'VECTTBL', '向量表读取发生总线错误', '检查 VTOR、向量表地址和存储器可访问性'], [30, 'FORCED', '可配置 Fault 升级为 HardFault', '优先查看 CFSR 中的原始 MemManage/BusFault/UsageFault'], [31, 'DEBUGEVT', '调试事件触发 HardFault', '检查断点、调试监视器和调试配置']];

function u32(value: number, label: string) { if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) throw new Error(`${label} 必须是 0x00000000 到 0xFFFFFFFF 的整数`); return value >>> 0; }
export function parseRegister(value: string): number { const input = value.trim().replaceAll('_', ''); if (!/^(?:0x)?[0-9a-f]+$/i.test(input)) throw new Error(`无效寄存器值：${value || '空'}`); const parsed = Number.parseInt(input.replace(/^0x/i, ''), 16); return u32(parsed, '寄存器值'); }
export function analyzeHardFault(input: HardFaultInput): HardFaultAnalysis {
  const normalized = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, u32(value, key.toUpperCase())])) as unknown as HardFaultInput;
  const findings: FaultFinding[] = [];
  for (const [bit, code, detail, action] of cfsrRules) if ((normalized.cfsr & (2 ** bit)) !== 0) findings.push({ register: 'CFSR', bit, code, detail, action });
  for (const [bit, code, detail, action] of hfsrRules) if ((normalized.hfsr & (2 ** bit)) !== 0) findings.push({ register: 'HFSR', bit, code, detail, action });
  const addresses: HardFaultAnalysis['addresses'] = [{ kind: 'PC', value: normalized.pc, sourceReady: true }, { kind: 'LR', value: normalized.lr, sourceReady: true }];
  if ((normalized.cfsr & (2 ** 7)) !== 0 && normalized.mmfar !== undefined) addresses.push({ kind: 'MMFAR', value: normalized.mmfar, sourceReady: false });
  if ((normalized.cfsr & (2 ** 15)) !== 0 && normalized.bfar !== undefined) addresses.push({ kind: 'BFAR', value: normalized.bfar, sourceReady: false });
  const warnings: string[] = [];
  if ((normalized.xpsr & (1 << 24)) === 0) warnings.push('xPSR 的 Thumb 状态位为 0，堆栈帧可能损坏或输入不完整');
  if ((normalized.cfsr & (2 ** 7)) !== 0 && normalized.mmfar === undefined) warnings.push('MMARVALID 已置位，但未提供 MMFAR');
  if ((normalized.cfsr & (2 ** 15)) !== 0 && normalized.bfar === undefined) warnings.push('BFARVALID 已置位，但未提供 BFAR');
  return { findings, addresses, summary: findings.length ? `检测到 ${findings.length} 个故障状态证据，优先用 PC 关联 ELF/MAP 定位源码` : '未检测到已知 CFSR/HFSR 状态位；需要结合堆栈、日志和芯片手册继续判断', warnings };
}
