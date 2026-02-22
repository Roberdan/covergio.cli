import { writable, derived } from 'svelte/store';
import type { Agent } from '$types';
import { api } from '$api/client';

const agents = writable<Agent[]>([]);
const loading = writable(false);
const filter = writable({ search: '', category: 'all', type: 'all' as 'all' | 'claude' | 'copilot' });

async function refresh() {
  loading.set(true);
  try {
    const data = await api.agents();
    agents.set(data);
  } catch {
    /* silent */
  } finally {
    loading.set(false);
  }
}

const filtered = derived([agents, filter], ([$agents, $filter]) => {
  return $agents.filter(a => {
    if ($filter.search && !a.name.toLowerCase().includes($filter.search.toLowerCase()) && !a.description.toLowerCase().includes($filter.search.toLowerCase())) return false;
    if ($filter.category !== 'all' && a.category !== $filter.category) return false;
    if ($filter.type !== 'all' && a.type !== $filter.type) return false;
    return true;
  });
});

const categories = derived(agents, $agents => [...new Set($agents.map(a => a.category))].sort());

export const agentsStore = { subscribe: agents.subscribe, agents, loading, filter, refresh, filtered, categories };
