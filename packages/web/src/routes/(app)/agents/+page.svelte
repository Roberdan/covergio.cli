<script lang="ts">
  import type { PageData } from './$types';
  import { PageHeader } from '$components/layout';
  import { Badge, Modal, Tabs } from '$components/ui';
  import { Search } from 'lucide-svelte';

  type CategoryKey =
    | 'all'
    | 'orchestration'
    | 'technical'
    | 'domain'
    | 'tools'
    | 'leadership'
    | 'business'
    | 'compliance'
    | 'copilot';

  const categoryTabs = [
    { label: 'All', value: 'all' },
    { label: 'Orchestration', value: 'orchestration' },
    { label: 'Technical', value: 'technical' },
    { label: 'Domain', value: 'domain' },
    { label: 'Tools', value: 'tools' },
    { label: 'Leadership', value: 'leadership' },
    { label: 'Business', value: 'business' },
    { label: 'Compliance', value: 'compliance' },
    { label: 'Copilot', value: 'copilot' }
  ] as const;

  const categoryColors: Record<Exclude<CategoryKey, 'all'>, string> = {
    orchestration: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    technical: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    domain: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    tools: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    leadership: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    business: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    compliance: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    copilot: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300'
  };

  let { data }: { data: PageData } = $props();

  let activeCategory = $state<CategoryKey>('all');
  let searchInput = $state('');
  let searchTerm = $state('');
  let selectedAgent = $state<(typeof data.agents)[number] | null>(null);

  const getInitials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('');

  const normalizeCategory = (agent: (typeof data.agents)[number]): Exclude<CategoryKey, 'all'> => {
    if (agent.type === 'copilot') return 'copilot';
    const cat = agent.category.toLowerCase();
    if (cat.includes('orchestrat')) return 'orchestration';
    if (cat.includes('domain') || cat.includes('document')) return 'domain';
    if (cat.includes('tool')) return 'tools';
    if (cat.includes('leader')) return 'leadership';
    if (cat.includes('business')) return 'business';
    if (cat.includes('compliance')) return 'compliance';
    if (cat.includes('technical') || cat.includes('engineering')) return 'technical';
    return 'technical';
  };

  const categoryLabel = (agent: (typeof data.agents)[number]) => {
    const category = normalizeCategory(agent);
    return categoryTabs.find((tab) => tab.value === category)?.label || 'Technical';
  };

  const filteredAgents = $derived.by(() => {
    const query = searchTerm.trim().toLowerCase();

    return data.agents.filter((agent) => {
      const mappedCategory = normalizeCategory(agent);
      if (activeCategory !== 'all' && mappedCategory !== activeCategory) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [agent.name, agent.description, agent.model, agent.category]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  });

  $effect(() => {
    const timeout = setTimeout(() => {
      searchTerm = searchInput;
    }, 250);

    return () => clearTimeout(timeout);
  });
</script>

<section class="space-y-6">
  <PageHeader title="Agent Catalog" description="56+ agents · 14 tools · Multi-agent orchestration platform" />

  <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
    <label class="relative w-full lg:max-w-md">
      <Search
        class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
      />
      <input
        type="search"
        placeholder="Search agents by name, model, or category"
        bind:value={searchInput}
        class="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-10 pr-3 text-sm text-zinc-800 outline-none ring-violet-500 transition focus:ring dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
    </label>

    <p class="text-sm text-zinc-600 dark:text-zinc-400">
      Showing {filteredAgents.length} of {data.counts.total} agents
    </p>
  </div>

  <div class="overflow-x-auto pb-1">
    <Tabs
      items={categoryTabs.map((tab) => ({ label: tab.label, value: tab.value }))}
      active={activeCategory}
      onchange={(value) => (activeCategory = value as CategoryKey)}
    />
  </div>

  <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
    {#each filteredAgents as agent}
      {@const mappedCategory = normalizeCategory(agent)}
      <button
        type="button"
        class="rounded-xl border border-zinc-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-violet-600"
        onclick={() => (selectedAgent = agent)}
      >
        <div class="flex items-start justify-between gap-3">
          <div
            class={`inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${categoryColors[mappedCategory]}`}
          >
            {getInitials(agent.name)}
          </div>
          <Badge variant="primary" size="sm">{agent.model}</Badge>
        </div>

        <h3 class="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">{agent.name}</h3>
        <p class="mt-1 truncate text-sm text-zinc-600 dark:text-zinc-400">{agent.description}</p>

        <div class="mt-3">
          <Badge variant="info" size="sm">{categoryLabel(agent)}</Badge>
        </div>
      </button>
    {/each}
  </div>
</section>

<Modal
  open={selectedAgent !== null}
  title={selectedAgent?.name || 'Agent details'}
  size="lg"
  onclose={() => (selectedAgent = null)}
>
  {#if selectedAgent}
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <Badge variant="primary" size="sm">{selectedAgent.model}</Badge>
        <Badge variant="info" size="sm">{categoryLabel(selectedAgent)}</Badge>
        <Badge variant="default" size="sm">{selectedAgent.type}</Badge>
      </div>

      <div>
        <h4 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Description</h4>
        <p class="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{selectedAgent.description}</p>
      </div>

      <div class="text-xs text-zinc-500 dark:text-zinc-400">
        Source file: {selectedAgent.sourceFile}
      </div>
    </div>
  {/if}
</Modal>
