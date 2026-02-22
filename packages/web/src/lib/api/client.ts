const BASE_URL = '';

async function fetchJson<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  plans: {
    list: (project?: string) => fetchJson<import('$types').Plan[]>(`/api/plans${project ? `?project=${project}` : ''}`),
    get: (id: number) => fetchJson<import('$types').Plan>(`/api/plans/${id}`)
  },
  kanban: () => fetchJson<import('$types').Plan[]>('/api/kanban'),
  git: () => fetchJson<import('$types').GitStatus>('/api/git-status'),
  tests: () => fetchJson<import('$types').TestResult>('/api/test-results'),
  metrics: () => fetchJson<import('$types').Metrics>('/api/metrics'),
  agents: () => fetchJson<import('$types').Agent[]>('/api/agents')
};
