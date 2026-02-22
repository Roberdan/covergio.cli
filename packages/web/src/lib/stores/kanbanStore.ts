import { writable, derived } from 'svelte/store';
import type { Plan } from '$types';
import { api } from '$api/client';

const items = writable<Plan[]>([]);
const loading = writable(false);

async function refresh() {
  loading.set(true);
  try {
    const data = await api.kanban();
    items.set(data);
  } catch {
    /* silent */
  } finally {
    loading.set(false);
  }
}

const columns = derived(items, $items => ({
  todo: $items.filter(i => i.status === 'todo'),
  doing: $items.filter(i => i.status === 'doing'),
  done: $items.filter(i => i.status === 'done')
}));

export const kanbanStore = { subscribe: items.subscribe, items, loading, refresh, columns };
