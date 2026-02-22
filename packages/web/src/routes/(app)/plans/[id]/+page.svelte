<script lang="ts">
  import { Badge, Card, Progress } from '$components/ui';
  import type { Plan, Task, Wave } from '$types';
  import type { PageData } from './$types';

  type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary';

  let { data }: { data: PageData } = $props();
  const plan = data.plan as Plan & { waves?: Wave[] };
  const waves = (plan.waves ?? []) as Array<Wave & { tasks?: Task[] }>;

  const progress = plan.tasks_total > 0 ? Math.round((plan.tasks_done / plan.tasks_total) * 100) : 0;

  const taskSummary = waves
    .flatMap((wave) => wave.tasks ?? [])
    .reduce(
      (acc, task) => ({
        total: acc.total + 1,
        done: acc.done + (task.status === 'done' ? 1 : 0),
        inProgress: acc.inProgress + (task.status === 'in_progress' ? 1 : 0),
        blocked: acc.blocked + (task.status === 'blocked' ? 1 : 0)
      }),
      { total: 0, done: 0, inProgress: 0, blocked: 0 }
    );

  const waveStatusVariant = (status: Wave['status']): BadgeVariant =>
    ({ pending: 'default', in_progress: 'info', done: 'success', blocked: 'error' })[status];

  const taskStatusVariant = (status: Task['status']): BadgeVariant =>
    ({ pending: 'default', in_progress: 'info', done: 'success', blocked: 'error', skipped: 'default' })[
      status
    ];

  const priorityVariant = (priority: Task['priority']): BadgeVariant =>
    ({ P0: 'error', P1: 'warning', P2: 'info', P3: 'default' })[priority];

  const toStatusLabel = (status: string): string => status.replace('_', ' ');
  const formatDate = (value: string | null | undefined): string =>
    value ? new Date(value).toLocaleDateString() : '—';
</script>

<section class="space-y-6 p-6">
  <a href="/plans" class="inline-flex items-center text-sm font-medium text-primary-700 hover:underline dark:text-primary-300">
    ← Plans
  </a>

  <Card variant="bordered" padding="lg">
    <div class="space-y-4">
      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 class="text-3xl font-semibold tracking-tight text-surface-900 dark:text-surface-100">
            {plan.name}
          </h1>
          <p class="mt-2 text-sm text-surface-600 dark:text-surface-300">
            {plan.description || 'No description available.'}
          </p>
        </div>
        <Badge variant={plan.status === 'done' ? 'success' : plan.status === 'doing' ? 'info' : 'default'}>
          {plan.status === 'doing' ? 'in progress' : plan.status}
        </Badge>
      </div>

      <Progress value={progress} label="Plan progress" />
    </div>
  </Card>

  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Card variant="bordered" padding="md"><p class="text-xs text-surface-500">Total Tasks</p><p class="mt-1 text-2xl font-semibold">{taskSummary.total}</p></Card>
    <Card variant="bordered" padding="md"><p class="text-xs text-surface-500">Done</p><p class="mt-1 text-2xl font-semibold text-emerald-600">{taskSummary.done}</p></Card>
    <Card variant="bordered" padding="md"><p class="text-xs text-surface-500">In Progress</p><p class="mt-1 text-2xl font-semibold text-blue-600">{taskSummary.inProgress}</p></Card>
    <Card variant="bordered" padding="md"><p class="text-xs text-surface-500">Blocked</p><p class="mt-1 text-2xl font-semibold text-red-600">{taskSummary.blocked}</p></Card>
  </div>

  <Card variant="bordered" padding="md">
    <h2 class="mb-3 text-lg font-semibold text-surface-900 dark:text-surface-100">Waves</h2>
    {#if waves.length === 0}
      <p class="text-sm text-surface-600 dark:text-surface-300">No waves available.</p>
    {:else}
      <div class="space-y-3">
        {#each waves as wave (wave.id)}
          <details class="overflow-hidden rounded-xl border border-surface-200 dark:border-surface-700">
            <summary class="flex cursor-pointer list-none items-center justify-between gap-3 bg-surface-50 px-4 py-3 dark:bg-surface-900/60">
              <div class="flex min-w-0 items-center gap-3">
                <h3 class="truncate font-medium text-surface-800 dark:text-surface-100">
                  {wave.wave_id} · {wave.name}
                </h3>
                <Badge size="sm" variant="primary">{(wave.tasks ?? []).length} tasks</Badge>
              </div>
              <Badge size="sm" variant={waveStatusVariant(wave.status)}>{toStatusLabel(wave.status)}</Badge>
            </summary>

            <div class="border-t border-surface-200 p-4 dark:border-surface-700">
              <div class="mb-3 text-xs text-surface-500">Updated {formatDate(plan.updated_at || plan.created_at)}</div>
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-surface-200 text-sm dark:divide-surface-700">
                  <thead>
                    <tr class="text-left text-xs uppercase tracking-wide text-surface-500">
                      <th class="px-2 py-2">ID</th>
                      <th class="px-2 py-2">Title</th>
                      <th class="px-2 py-2">Status</th>
                      <th class="px-2 py-2">Priority</th>
                      <th class="px-2 py-2">Model</th>
                      <th class="px-2 py-2">Effort</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-surface-100 dark:divide-surface-800">
                    {#each wave.tasks ?? [] as task (task.id)}
                      <tr>
                        <td class="whitespace-nowrap px-2 py-2 font-mono text-xs">{task.task_id}</td>
                        <td class="px-2 py-2 text-surface-700 dark:text-surface-200">{task.title}</td>
                        <td class="px-2 py-2">
                          <Badge size="sm" variant={taskStatusVariant(task.status)}>
                            {#if task.status === 'skipped'}
                              <span class="line-through">skipped</span>
                            {:else}
                              {toStatusLabel(task.status)}
                            {/if}
                          </Badge>
                        </td>
                        <td class="px-2 py-2"><Badge size="sm" variant={priorityVariant(task.priority)}>{task.priority}</Badge></td>
                        <td class="px-2 py-2 font-mono text-xs text-surface-600 dark:text-surface-300">{task.model}</td>
                        <td class="px-2 py-2">
                          <div class="flex items-center gap-1">
                            {#each [1, 2, 3] as level}
                              <span
                                class={`h-2.5 w-2.5 rounded-full ${
                                  level <= (task.effort_level ?? 1)
                                    ? 'bg-primary-500 dark:bg-primary-400'
                                    : 'bg-surface-300 dark:bg-surface-700'
                                }`}
                              ></span>
                            {/each}
                          </div>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        {/each}
      </div>
    {/if}
  </Card>
</section>
