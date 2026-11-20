export const AGENT_PROTOCOL_VERSION: 1;
export const AGENT_CAPABILITIES: Readonly<Record<string, string>>;
export interface AgentRouteDefinition {
  readonly id: string;
  readonly method: 'GET' | 'POST' | 'DELETE';
  readonly path: string;
  readonly capability: string | null;
  readonly timeoutMs: number;
  readonly binary: boolean;
}
export const AGENT_ROUTES: Readonly<Record<string, AgentRouteDefinition>>;
export function listAgentCapabilities(platform?: string): string[];
export function validateAgentContract(): { protocolVersion: number; routes: number; capabilities: number };
