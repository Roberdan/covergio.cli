<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { LayoutGrid, Table as TableIcon } from 'lucide-svelte';
  import DataTable from '$components/data/DataTable.svelte';
  import { Badge, Card, Progress, Tabs } from '$components/ui';
  import type { Plan } from '$types';
  import type { PageData } from './$types';

  type ViewMode = 'kanban' | 'table';
  type PlanStatus = Plan['status'];
  type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary';

  let { data }: { data: PageData } = $props();
  const plans = (data.plans ?? []) as Plan[];
  let viewMode = $state<ViewMode>('kanban');

  const tabItems = [
    { label: 'Kanban', value: 'kanban' },
    { label: 'Table', value: 'table' }
  ];

  const tableColumns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'project', label: 'Project', sortable: true },
    { key: 'status', label: 'Status', sortable: false },
    { key: 'progress', label: 'Progress', sortable: true },
    { key: 'tasks', label: 'Tasks', sortable: true },
    { key: 'created', label: 'Created', sortable: true },
    { key: 'updated', label: 'Updated', sortable: true }
  ];

  const toStatusLabel = (status: PlanStatus): string =>
    ({ todo: 'Todo', doing: 'In Progress', done: 'Done', archived: 'Archived' })[status];

  const toStatusVariant = (status: PlanStatus): BadgeVariant =>
    ({ todo: 'default', doing: 'info', done: 'success', archived: 'warning' })[status];

  const toProgress = (plan: Plan): number =>
    plan.tasks_total > 0 ? Math.round((plan.tasks_done / plan.tasks_total) * 100) : 0;

  const toWaveCount = (plan: Plan): number => {
    const value =
      (plan as Record<string, unknown>).waves_total ?? (plan as Record<string, unknown>).wave_count;
    return Number(value ?? 0);
  };

  const formatDate = (value: string | null | undefined): string => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
  };

  const tableRows = plans.map((plan) => ({
    id: plan.id,
    name: { type: 'link', label: plan.name, href: `/plans/${plan.id}` },
    project: plan.project_id,
    status: { type: 'badge', label: toStatusLabel(plan.status), variant: toStatusVariant(plan.status) },
    progress: `${toProgress(plan)}%`,
    tasks: `${plan.tasks_done}/${plan.tasks_total}`,
    created: formatDate(plan.created_at),
    updated: formatDate(plan.updated_at || plan.created_at)
  }));

  const kanbanColumns = [
    { title: 'Todo', status: 'todo' as PlanStatus },
    { title: 'In Progress', status: 'doing' as PlanStatus },
    { title: 'Done', status: 'done' as PlanStatus }
  ];

  onMount(() => {
    const saved = localStorage.getItem('plans-view');
    if (saved === 'kanban' || saved === 'table') {
      viewMode = saved;
    }
  });

  $effect(() => {
    if (browser) {
      localStorage.setItem('plans-view', viewMode);
    }
  });
</script>

<section class="space-y-6 p-6">
  <header class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
    <div>
      <h1 class="text-3xl font-semibold tracking-tight text-surface-900 dark:text-surface-100">Plans</h1>
      <p class="mt-2 text-sm text-surface-600 dark:text-surface-300">
        Browse plans in Kanban or Table mode.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <Tabs items={tabItems} active={viewMode} onchange={(value) => (viewMode = value as ViewMode)} />
      <div
        role="tablist"
        aria-label="View mode"
        class="inline-flex rounded-lg border border-surface-200 bg-white p-1 dark:border-surface-700 dark:bg-surface-900"
      >
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'kanban'}
          class={`rounded-md p-2 transition ${
            viewMode === 'kanban'
              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
              : 'text-surface-600 hover:text-surface-900 dark:text-surface-300 dark:hover:text-surface-100'
          }`}
          onclick={() => (viewMode = 'kanban')}
        >
          <LayoutGrid class="h-4 w-4" />
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'table'}
          class={`rounded-md p-2 transition ${
            viewMode === 'table'
              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
              : 'text-surface-600 hover:text-surface-900 dark:text-surface-300 dark:hover:text-surface-100'
          }`}
          onclick={() => (viewMode = 'table')}
        >
          <TableIcon class="h-4 w-4" />
        </button>
      </div>
    </div>
  </header>

  {#if plans.length === 0}
    <Card variant="bordered" padding="lg">
      <p class="text-sm text-surface-600 dark:text-surface-300">No plans available.</p>
    </Card>
  {:else if viewMode === 'kanban'}
    <div class="overflow-x-auto pb-2">
      <div class="flex min-w-max gap-4 lg:grid lg:min-w-0 lg:grid-cols-3">
        {#each kanbanColumns as column}
          <div class="w-[18rem] shrink-0 lg:w-auto lg:shrink">
            <Card variant="bordered" padding="sm">
              <div class="mb-3 flex items-center justify-between">
                <h2 class="text-sm font-semibold text-surface-800 dark:text-surface-200">{column.title}</h2>
                <Badge size="sm" variant={toStatusVariant(column.status)}>
                  {plans.filter((plan) => plan.status === column.status).length}
                </Badge>
              </div>

              <div class="space-y-3">
                {#each plans.filter((plan) => plan.status === column.status) as plan (plan.id)}
                  <a
                    href={`/plans/${plan.id}`}
                    class="block rounded-xl border border-surface-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg dark:border-surface-700 dark:bg-surface-900"
                  >
                    <div class="flex items-start justify-between gap-3">
                      <h3 class="font-medium text-surface-900 dark:text-surface-100">{plan.name}</h3>
                      <Badge size="sm" variant="primary">{plan.project_id}</Badge>
                    </div>

                    <div class="mt-3">
                      <Progress value={toProgress(plan)} size="sm" />
                    </div>

                    <div class="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-surface-600 dark:text-surface-300">
                      <span>Waves</span>
                      <span class="text-right">{toWaveCount(plan)}</span>
                      <span>Tasks</span>
                      <span class="text-right">{plan.tasks_done}/{plan.tasks_total}</span>
                      <span>Updated</span>
                      <span class="text-right">{formatDate(plan.updated_at || plan.created_at)}</span>
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
      <DataTable columns={tableColumns} rows={tableRows} sortBy="updated" sortDir="desc" />
    </Card>
  {/if}
</section>
