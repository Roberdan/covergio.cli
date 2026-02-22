<script lang="ts">
  import { Check, ChevronDown, Search } from 'lucide-svelte';

  interface AgentItem {
    id: string;
    name: string;
    description: string;
    model: string;
    tier?: 'fast' | 'standard' | 'premium';
    category?: string;
  }
  interface Props {
    agents: AgentItem[];
    selected: string;
    onselect?: (agentId: string) => void;
  }

  let { agents, selected, onselect }: Props = $props();
  let open = $state(false);
  let query = $state('');
  let root = $state<HTMLDivElement | null>(null);
  let searchInput = $state<HTMLInputElement | null>(null);

  const selectedAgent = $derived(agents.find((agent) => agent.id === selected) ?? agents[0]);
  const filteredAgents = $derived(
    agents.filter((agent) => `${agent.name} ${agent.description} ${agent.model}`.toLowerCase().includes(query.toLowerCase().trim()))
  );
  const groupedAgents = $derived(
    filteredAgents.reduce<Record<string, AgentItem[]>>((acc, agent) => {
      const key = agent.category ?? 'other';
      (acc[key] ??= []).push(agent);
      return acc;
    }, {})
  );

  $effect(() => {
    const close = (event: MouseEvent) => root && !root.contains(event.target as Node) && (open = false);
    document.addEventListener('click', close);
    if (open) setTimeout(() => searchInput?.focus(), 0);
    return () => document.removeEventListener('click', close);
  });

  function badgeClass(agent: AgentItem): string {
    const tier = agent.tier ?? (agent.model.includes('opus') ? 'premium' : agent.model.includes('haiku') ? 'fast' : 'standard');
    return tier === 'premium'
      ? 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-300'
      : tier === 'fast'
        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
        : 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300';
  }

  function titleCase(value: string): string {
    return value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }
</script>

<div bind:this={root} class="relative inline-block w-full max-w-sm">
  <button
    type="button"
    class="flex w-full items-center justify-between rounded-xl border border-surface-300 bg-white px-3 py-2 text-left text-sm text-surface-800 shadow-sm hover:border-violet-400 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100"
    onclick={() => (open = !open)}
  >
    <span class="min-w-0">
      <span class="block truncate font-medium">{selectedAgent?.name ?? 'Select agent'}</span>
      {#if selectedAgent}
        <span class={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeClass(selectedAgent)}`}>{selectedAgent.model}</span>
      {/if}
    </span>
    <ChevronDown size={16} class={`shrink-0 transition ${open ? 'rotate-180' : ''}`} />
  </button>

  {#if open}
    <div class="absolute z-40 mt-2 w-full rounded-xl border border-surface-200 bg-white p-2 shadow-xl dark:border-surface-700 dark:bg-surface-900">
      <label class="mb-2 flex items-center gap-2 rounded-lg border border-surface-200 px-2 py-1.5 dark:border-surface-700">
        <Search size={14} class="text-surface-500 dark:text-surface-400" />
        <input bind:this={searchInput} bind:value={query} placeholder="Search agents..." class="w-full bg-transparent text-xs text-surface-800 outline-none placeholder:text-surface-400 dark:text-surface-100" />
      </label>

      <div class="max-h-72 space-y-2 overflow-y-auto pr-1">
        {#if !filteredAgents.length}
          <p class="px-2 py-4 text-center text-xs text-surface-500 dark:text-surface-400">No agents found.</p>
        {:else}
          {#each Object.entries(groupedAgents) as [category, items]}
            <div>
              <p class="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">{titleCase(category)}</p>
              <div class="space-y-1">
                {#each items as agent}
                  <button
                    type="button"
                    class={`w-full rounded-lg border px-2 py-2 text-left transition ${agent.id === selected ? 'border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-900/20' : 'border-transparent hover:bg-surface-100 dark:hover:bg-surface-800'}`}
                    onclick={() => {
                      onselect?.(agent.id);
                      open = false;
                    }}
                  >
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0">
                        <p class="truncate text-sm font-medium text-surface-800 dark:text-surface-100">{agent.name}</p>
                        <p class="truncate text-xs text-surface-500 dark:text-surface-400">{agent.description}</p>
                        <span class={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeClass(agent)}`}>{agent.model}</span>
                      </div>
                      {#if agent.id === selected}<Check size={14} class="mt-1 shrink-0 text-violet-600 dark:text-violet-300" />{/if}
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>
