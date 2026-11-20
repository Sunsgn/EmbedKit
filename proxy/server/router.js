import { AGENT_ROUTES } from '../../contracts/agent-api.js';

const declaredRouteIds = new Set(Object.values(AGENT_ROUTES).map(route => route.id));

export class AgentRouter {
  constructor() { this.routes = []; this.ids = new Set(); }

  register(definition) {
    if (!definition || !declaredRouteIds.has(definition.id)) throw new Error(`Agent route is not declared in the shared contract: ${definition?.id || 'missing'}`);
    if (this.ids.has(definition.id)) throw new Error(`Agent route is already registered: ${definition.id}`);
    if (!['GET', 'POST', 'DELETE'].includes(definition.method) || typeof definition.handler !== 'function') throw new Error(`Agent route definition is invalid: ${definition.id}`);
    if (typeof definition.path !== 'string' && !(definition.path instanceof RegExp)) throw new Error(`Agent route matcher is invalid: ${definition.id}`);
    this.ids.add(definition.id); this.routes.push(Object.freeze({ ...definition }));
    return this;
  }

  async dispatch(context) {
    for (const route of this.routes) {
      if (route.method !== context.req.method) continue;
      const match = typeof route.path === 'string' ? route.path === context.pathname : context.pathname.match(route.path);
      if (!match) continue;
      await route.handler({ ...context, match });
      return true;
    }
    return false;
  }

  registeredIds() { return [...this.ids]; }
}
