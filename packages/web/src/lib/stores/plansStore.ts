import { writable, derived } from 'svelte/store';
import type { Plan } from '$types';
import { api } from '$api/client';

const plans = writable<Plan[]>([]);
const loading = writable(false);
const error = writable<string | null>(null);

async function refresh() {
  loading.set(true);
  error.set(null);
  try {
    const data = await api.plans.list();
    plans.set(data);
  } catch (e) {
    error.set(e instanceof Error ? e.message : 'Failed to load plans');
  } finally {
    loading.set(false);
  }
}

const activePlans = derived(plans, $plans => $plans.filter(p => p.status === 'doing'));
const completedPlans = derived(plans, $plans => $plans.filter(p => p.status === 'done'));

export const plansStore = { subscribe: plans.subscribe, plans, loading, error, refresh, activePlans, completedPlans };
