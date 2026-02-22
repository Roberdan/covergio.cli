<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { ArrowUpDown, LayoutGrid, Table as TableIcon } from 'lucide-svelte';
  import { Badge, Card, Progress, Tabs } from '$components/ui';
  import type { PageData } from './$types';

  type ViewMode = 'kanban' | 'table';
  type SortDir = 'asc' | 'desc';
  type PlanStatus = 'todo' | 'doing' | 'done' | 'archived';
  type SortKey = 'name' | 'project_id' | 'status' | 'progress' | 'created_at' | 'completed_at';
  type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary';
  interface PlanView { id: number; name: string; status: PlanStatus; tasks_done: number; tasks_total: number; project_id: string; created_at: string; completed_at: string | null; }

  let { data }: { data: PageData } = $props();
  let viewMode = $state<ViewMode>('kanban');
  let sortBy = $state<SortKey>('created_at');
  let sortDir = $state<SortDir>('desc');

  const tabItems = [{ label: 'Kanban', value: 'kanban' }, { label: 'Table', value: 'table' }];
  const tableColumns: Array<{ key: SortKey; label: string }> = [
    { key: 'name', label: 'Name' }, { key: 'project_id', label: 'Project' }, { key: 'status', label: 'Status' },
    { key: 'progress', label: 'Progress' }, { key: 'created_at', label: 'Created' }, { key: 'completed_at', label: 'Completed' }
  ];
  const boardColumns = [{ title: 'Todo', status: 'todo' as const }, { title: 'Doing', status: 'doing' as const }, { title: 'Done', status: 'done' as const }];
  const statusLabels: Record<PlanStatus, string> = { todo: 'Todo', doing: 'In Progress', done: 'Done', archived: 'Archived' };
  const statusVariants: Record<PlanStatus, BadgeVariant> = { todo: 'default', doing: 'info', done: 'success', archived: 'warning' };
  const validStatuses: PlanStatus[] = ['todo', 'doing', 'done', 'archived'];

  const toNumber = (value: unknown): number => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  const toStatus = (value: unknown): PlanStatus => {
    const status = String(value ?? 'todo') as PlanStatus;
    return validStatuses.includes(status) ? status : 'todo';
  };
  const toPlan = (raw: Record<string, unknown>): PlanView => ({
    id: toNumber(raw.id), name: String(raw.name ?? `Plan ${String(raw.id ?? 'unknown')}`), status: toStatus(raw.status),
    tasks_done: toNumber(raw.tasks_done), tasks_total: toNumber(raw.tasks_total), project_id: String(raw.project_id ?? '—'),
    created_at: String(raw.created_at ?? ''), completed_at: raw.completed_at ? String(raw.completed_at) : null
  });
  const toKanbanPlan = (raw: Record<string, unknown>): PlanView => ({
    id: toNumber(raw.plan_id ?? raw.id), name: String(raw.plan_name ?? raw.name ?? `Plan ${String(raw.plan_id ?? raw.id ?? 'unknown')}`),
    status: toStatus(raw.status), tasks_done: toNumber(raw.tasks_done), tasks_total: toNumber(raw.tasks_total),
    project_id: String(raw.project_id ?? raw.project_name ?? '—'), created_at: String(raw.created_at ?? ''),
    completed_at: raw.completed_at ? String(raw.completed_at) : null
  });
  const toProgress = (plan: PlanView): number => plan.tasks_total > 0 ? Math.round((plan.tasks_done / plan.tasks_total) * 100) : plan.status === 'done' ? 100 : 0;
  const toDateValue = (value: string | null | undefined): number => {
    if (!value) return 0;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? 0 : time;
  };
  const formatDate = (value: string | null | undefined): string => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
  };

  const plans = $derived.by(() => ((data.plans ?? []) as Record<string, unknown>[]).map(toPlan));
  const kanbanPlans = $derived.by(() => ((data.kanban ?? []) as Record<string, unknown>[]).map(toKanbanPlan));
  const boardPlans = $derived.by(() => (kanbanPlans.length > 0 ? kanbanPlans : plans));
  const cardsByStatus = $derived.by(() => {
    const groups: Record<'todo' | 'doing' | 'done', PlanView[]> = { todo: [], doing: [], done: [] };
    boardPlans.forEach((plan) => { if (plan.status === 'todo' || plan.status === 'doing' || plan.status === 'done') groups[plan.status].push(plan); });
    return groups;
  });
  const sortedPlans = $derived.by(() => {
    const rows = [...plans];
    rows.sort((left, right) => {
      if (sortBy === 'progress') return toProgress(left) - toProgress(right);
      if (sortBy === 'created_at') return toDateValue(left.created_at) - toDateValue(right.created_at);
      if (sortBy === 'completed_at') return toDateValue(left.completed_at) - toDateValue(right.completed_at);
      return String(left[sortBy]).localeCompare(String(right[sortBy]));
    });
    return sortDir === 'asc' ? rows : rows.reverse();
  });

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) return (sortDir = sortDir === 'asc' ? 'desc' : 'asc');
    sortBy = key;
    sortDir = key === 'created_at' || key === 'completed_at' ? 'desc' : 'asc';
  };

  onMount(() => {
    const saved = localStorage.getItem('plans-view');
    if (saved === 'kanban' || saved === 'table') viewMode = saved;
  });
  $effect(() => { if (browser) localStorage.setItem('plans-view', viewMode); });
</script>

<section class="space-y-6 p-6">
  <header class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div>
      <h1 class="text-3xl font-semibold tracking-tight text-surface-900 dark:text-surface-100">Plans</h1>
      <p class="mt-2 text-sm text-surface-600 dark:text-surface-300">Browse plans in Kanban or Table mode.</p>
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <Badge size="md" variant="primary">{plans.length} total</Badge>
      <Tabs items={tabItems} active={viewMode} onchange={(value) => (viewMode = value as ViewMode)} />
      <div role="tablist" aria-label="View mode" class="inline-flex rounded-lg border border-surface-200 bg-white p-1 dark:border-surface-700 dark:bg-surface-900">
        <button type="button" role="tab" aria-selected={viewMode === 'kanban'} class={`rounded-md p-2 transition ${viewMode === 'kanban' ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300' : 'text-surface-600 hover:text-surface-900 dark:text-surface-300 dark:hover:text-surface-100'}`} onclick={() => (viewMode = 'kanban')}><LayoutGrid class="h-4 w-4" /></button>
        <button type="button" role="tab" aria-selected={viewMode === 'table'} class={`rounded-md p-2 transition ${viewMode === 'table' ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300' : 'text-surface-600 hover:text-surface-900 dark:text-surface-300 dark:hover:text-surface-100'}`} onclick={() => (viewMode = 'table')}><TableIcon class="h-4 w-4" /></button>
      </div>
    </div>
  </header>

  {#if plans.length === 0}
    <Card variant="bordered" padding="lg"><p class="text-sm text-surface-600 dark:text-surface-300">No plans available.</p></Card>
  {:else if viewMode === 'kanban'}
    <div class="overflow-x-auto pb-2">
      <div class="flex min-w-max gap-4 lg:grid lg:min-w-0 lg:grid-cols-3">
        {#each boardColumns as column}
          {@const cards = cardsByStatus[column.status]}
          <div class="w-[18rem] shrink-0 lg:w-auto lg:shrink">
            <Card variant="bordered" padding="sm">
              <div class="mb-3 flex items-center justify-between">
                <h2 class="text-sm font-semibold text-surface-800 dark:text-surface-200">{column.title}</h2>
                <Badge size="sm" variant={statusVariants[column.status]}>{cards.length}</Badge>
              </div>
              <div class="space-y-3">
                {#each cards as plan (plan.id)}
                  <a href={`/plans/${plan.id}`} class="block rounded-xl border border-surface-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg dark:border-surface-700 dark:bg-surface-900">
                    <div class="flex items-start justify-between gap-3">
                      <h3 class="font-medium text-surface-900 dark:text-surface-100">{plan.name}</h3>
                      <Badge size="sm" variant={statusVariants[plan.status]}>{statusLabels[plan.status]}</Badge>
                    </div>
                    <p class="mt-2 text-xs text-surface-600 dark:text-surface-300">Project: {plan.project_id}</p>
                    <div class="mt-3 space-y-1">
                      <Progress value={toProgress(plan)} size="sm" />
                      <p class="text-xs text-surface-600 dark:text-surface-300">{plan.tasks_done}/{plan.tasks_total} tasks</p>
                    </div>
                    <div class="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-surface-600 dark:text-surface-300">
                      <span>Created</span><span class="text-right">{formatDate(plan.created_at)}</span>
                      <span>Completed</span><span class="text-right">{formatDate(plan.completed_at)}</span>
                    </div>
                  </a>
                {/each}
              </div>
            </Card>
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <Card variant="bordered" padding="md">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-surface-200 dark:divide-surface-700">
          <thead class="bg-surface-50 dark:bg-surface-900">
            <tr>
              {#each tableColumns as column}
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-500">
                  <button type="button" class="inline-flex items-center gap-1" onclick={() => toggleSort(column.key)}>
                    {column.label} <ArrowUpDown class="h-3.5 w-3.5" />
                  </button>
                </th>
              {/each}
            </tr>
          </thead>
          <tbody class="divide-y divide-surface-100 bg-white dark:divide-surface-800 dark:bg-surface-950">
            {#each sortedPlans as plan (plan.id)}
              <tr class="align-top">
                <td class="px-4 py-3"><a href={`/plans/${plan.id}`} class="font-medium text-primary-700 hover:underline dark:text-primary-300">{plan.name}</a></td>
                <td class="px-4 py-3 text-sm text-surface-700 dark:text-surface-200">{plan.project_id}</td>
                <td class="px-4 py-3"><Badge size="sm" variant={statusVariants[plan.status]}>{statusLabels[plan.status]}</Badge></td>
                <td class="min-w-[14rem] px-4 py-3">
                  <div class="space-y-1">
                    <Progress value={toProgress(plan)} size="sm" />
                    <p class="text-xs text-surface-600 dark:text-surface-300">{toProgress(plan)}% · {plan.tasks_done}/{plan.tasks_total}</p>
                  </div>
                </td>
                <td class="px-4 py-3 text-sm text-surface-700 dark:text-surface-200">{formatDate(plan.created_at)}</td>
                <td class="px-4 py-3 text-sm text-surface-700 dark:text-surface-200">{formatDate(plan.completed_at)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Card>
  {/if}
</section>
