// @ts-nocheck
import type { PageServerLoad } from './$types';

export const load = async ({ fetch }: Parameters<PageServerLoad>[0]) => {
  try {
    const res = await fetch('/api/agents');
    const agents = await res.json();
    return { agents };
  } catch {
    return { agents: [] };
  }
};
