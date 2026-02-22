import { writable } from 'svelte/store';
import type { Metrics } from '$types';
import { api } from '$api/client';

const metrics = writable<Metrics | null>(null);
const loading = writable(false);

async function refresh() {
  loading.set(true);
  try {
    const data = await api.metrics();
    metrics.set(data);
  } catch {
    /* silent */
  } finally {
    loading.set(false);
  }
}

export const metricsStore = { subscribe: metrics.subscribe, metrics, loading, refresh };
