import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
  try {
    const res = await fetch('/api/agents');
    const agents = await res.json();
    return { agents };
  } catch {
    return { agents: [] };
  }
};
