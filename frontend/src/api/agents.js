import { api } from './client';

/** POST /agents/{scenario}/run — generate AI campaign copy.
 *  scenario: 'inactive' | 'featured' | 'vip'
 *  Optional body: { product_id } for 'featured' scenario. */
export function runAgentScenario(scenario, data = {}) {
  return api.post(`/agents/${scenario}/run`, data);
}

/** GET /agents/history — list previously generated campaign kits for this tenant. */
export function fetchAgentHistory() {
  return api.get('/agents/history');
}
