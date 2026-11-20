import type { FlowVariable, Incoming, TestStep } from './domain';
import { resolveFlowVariables } from './domain';

export interface IndexedIncoming { item: Incoming; index: number }
export type ResponseEvaluation =
  | { state: 'pending' }
  | { state: 'received' | 'matched'; observed: string; consumedThrough: number }
  | { state: 'failure'; message: string; consumedThrough: number };

export function evaluateIncomingResponse(step: TestStep, candidates: IndexedIncoming[], variables: FlowVariable[], shouldMatch: boolean, expectedValue = step.data, failureValue = ''): ResponseEvaluation {
  if (!candidates.length) return { state: 'pending' };
  const sources = candidates.map(({ item }) => step.hex ? item.hex : item.text), combined = sources.join(step.hex ? ' ' : ''), consumedThrough = candidates[candidates.length - 1].index + 1;
  if (!shouldMatch) return { state: 'received', observed: sources[0], consumedThrough: candidates[0].index + 1 };
  const expected = resolveFlowVariables(expectedValue, variables), failure = resolveFlowVariables(failureValue, variables);
  if (failure && new RegExp(failure, 'i').test(combined)) return { state: 'failure', message: `设备返回失败响应：${failureValue}`, consumedThrough };
  const matched = step.matchMode === 'equals'
    ? sources.some(source => source.trim() === expected.trim()) || combined.trim() === expected.trim()
    : step.matchMode === 'regex' ? new RegExp(expected).test(combined) : combined.includes(expected);
  return matched ? { state: 'matched', observed: combined, consumedThrough } : { state: 'pending' };
}

export function captureResponseVariable(step: TestStep, response: string, variables: FlowVariable[], idFactory: () => string = () => crypto.randomUUID()) {
  const name = step.captureName?.trim().toUpperCase().replace(/\W/g, '_'), expression = step.captureRegex?.trim();
  if (!name || !expression) return null;
  const match = new RegExp(resolveFlowVariables(expression, variables)).exec(response);
  if (!match) throw new Error(`响应通过，但未提取到变量 ${name}`);
  const value = match.groups ? Object.values(match.groups)[0] : (match[1] ?? match[0]), existing = variables.some(item => item.name === name);
  const next = existing ? variables.map(item => item.name === name ? { ...item, value } : item) : [...variables, { id: idFactory(), name, value, secret: false }];
  return { name, value, variables: next };
}

export function assignRuntimeVariable(nameInput: string, value: string, variables: FlowVariable[], idFactory: () => string = () => crypto.randomUUID()) {
  const name = (nameInput || 'VARIABLE').trim().toUpperCase().replace(/\W/g, '_'), existing = variables.some(item => item.name === name);
  return existing ? variables.map(item => item.name === name ? { ...item, value } : item) : [...variables, { id: idFactory(), name, value, secret: false }];
}
