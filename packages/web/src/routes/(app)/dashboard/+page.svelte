<script lang="ts">
  import { browser } from '$app/environment';
  import LineChart from '$components/charts/LineChart.svelte';
  import DonutChart from '$components/charts/DonutChart.svelte';
  import StatCard from '$components/data/StatCard.svelte';
  import { PageHeader } from '$components/layout';
  import { Badge, Card, Progress } from '$components/ui';
  import { metricsStore } from '$stores/metricsStore';
  import { plansStore } from '$stores/plansStore';
  import type { TokenData } from '$types';
  import type { PageData } from './$types';

  type PlanStatus = 'todo' | 'doing' | 'done' | 'archived';
  type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary';

  interface PlanSummary { id: number; name: string; status: PlanStatus; tasks_done: number; tasks_total: number; updated_at: string; }
  interface DashboardMetrics { totalPlans: number; activePlans: number; totalTasks: number; doneTasks: number; completionRate: number; tokenData?: TokenData | null; }

  let { data }: { data: PageData } = $props();
  const plansState = plansStore.plans;
  const metricsState = metricsStore.metrics;

  const fallbackMetrics: DashboardMetrics = { totalPlans: 0, activePlans: 0, totalTasks: 0, doneTasks: 0, completionRate: 0, tokenData: null };

  const statusMeta: Record<PlanStatus, { label: string; variant: BadgeVariant }> = {
    todo: { label: 'To do', variant: 'warning' },
    doing: { label: 'In progress', variant: 'info' },
    done: { label: 'Done', variant: 'success' },
    archived: { label: 'Archived', variant: 'default' }
  };

  const formatDateLabel = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const completionForPlan = (plan: PlanSummary) => (plan.tasks_total > 0 ? Math.round((plan.tasks_done / plan.tasks_total) * 100) : plan.status === 'done' ? 100 : 0);
  const toRelativeTime = (timestamp: string) => {
    const parsed = new Date(timestamp).getTime();
    if (Number.isNaN(parsed)) return 'Unknown update';
    const diffSeconds = Math.round((parsed - Date.now()) / 1000);
    const absSeconds = Math.abs(diffSeconds);
    const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    if (absSeconds < 60) return 'just now';
    if (absSeconds < 3600) return formatter.format(Math.round(diffSeconds / 60), 'minute');
    if (absSeconds < 86400) return formatter.format(Math.round(diffSeconds / 3600), 'hour');
    return formatter.format(Math.round(diffSeconds / 86400), 'day');
  };

  $effect(() => {
    if (!browser) return;
    void plansStore.refresh();
    void metricsStore.refresh();
  });

  const serverPlans = $derived.by<PlanSummary[]>(() =>
    Array.isArray(data.plans) ? (data.plans as unknown as PlanSummary[]) : []
  );
  const serverMetrics = $derived.by<DashboardMetrics>(() => ({ ...fallbackMetrics, ...((data.metrics as Partial<DashboardMetrics> | undefined) ?? {}) }));
  const plans = $derived.by<PlanSummary[]>(() => {
    const livePlans = $plansState as PlanSummary[];
    return livePlans.length > 0 ? livePlans : serverPlans;
  });
  const metrics = $derived.by<DashboardMetrics>(() => {
    const liveMetrics = $metricsState as DashboardMetrics | null;
    return liveMetrics ? { ...fallbackMetrics, ...liveMetrics } : serverMetrics;
  });

  const activitySeries = $derived.by(() => {
    const daily = metrics.tokenData?.dailyActivity ?? [];
    if (daily.length > 0) {
      const sorted = [...daily].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-7);
      return { labels: sorted.map((entry) => formatDateLabel(new Date(entry.date))), values: sorted.map((entry) => Number(entry.messageCount ?? 0)) };
    }
    const today = new Date();
    const emptySeries = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      return { label: formatDateLabel(date), value: 0 };
    });
    return { labels: emptySeries.map((entry) => entry.label), values: emptySeries.map((entry) => entry.value) };
  });

  const donutSeries = $derived.by(() => {
    if (plans.length === 0) return { labels: ['Done', 'In Progress', 'Pending'], values: [22, 14, 10] };
    const done = plans.reduce((sum, plan) => sum + Number(plan.tasks_done ?? 0), 0);
    const total = plans.reduce((sum, plan) => sum + Number(plan.tasks_total ?? 0), 0);
    const inProgress = plans.filter((plan) => plan.status === 'doing').reduce((sum, plan) => sum + Math.max(Number(plan.tasks_total ?? 0) - Number(plan.tasks_done ?? 0), 0), 0);
    const pending = Math.max(total - done - inProgress, 0);
    return done + inProgress + pending > 0 ? { labels: ['Done', 'In Progress', 'Pending'], values: [done, inProgress, pending] } : { labels: ['Done', 'In Progress', 'Pending'], values: [22, 14, 10] };
  });

  const recentPlans = $derived.by<PlanSummary[]>(() => {
    return [...plans]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5);
  });
</script>

<div class="space-y-8">
  <PageHeader title="Dashboard" description="Overview of your AI agent orchestration" />

  <section class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
    <StatCard value={metrics.totalPlans} label="Total Plans" icon="LayoutDashboard" variant="primary" />
    <StatCard value={metrics.doneTasks} label="Tasks Done" trend={metrics.completionRate} icon="CheckCircle2" variant="success" />
    <StatCard value={metrics.activePlans} label="Active Plans" icon="Activity" variant="warning" />
    <StatCard value={`${metrics.completionRate}%`} label="Completion" icon="TrendingUp" variant="default" />
  </section>

  <section class="grid grid-cols-1 gap-5 lg:grid-cols-3">
    <div class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 lg:col-span-2">
      <Card variant="bordered">
        {#snippet children()}
          <div class="space-y-4">
            <div><h2 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">7-day Activity</h2><p class="text-sm text-zinc-600 dark:text-zinc-400">Daily message count over time</p></div>
            <LineChart labels={activitySeries.labels} datasets={[{ label: 'Messages', data: activitySeries.values, color: '#6366f1' }]} showArea={true} height={320} />
          </div>
        {/snippet}
      </Card>
    </div>

    <div class="rounded-xl border border-zinc-200/80 dark:border-zinc-800 lg:col-span-1">
      <Card variant="bordered">
        {#snippet children()}
          <div class="space-y-4">
            <div><h2 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Task Distribution</h2><p class="text-sm text-zinc-600 dark:text-zinc-400">Status spread across all tracked tasks</p></div>
            <DonutChart labels={donutSeries.labels} data={donutSeries.values} colors={['#10b981', '#6366f1', '#f59e0b']} centerLabel="Done" centerValue={metrics.doneTasks} height={320} />
          </div>
        {/snippet}
      </Card>
    </div>
  </section>

  <section class="rounded-xl border border-zinc-200/80 dark:border-zinc-800">
    <Card variant="bordered">
      {#snippet children()}
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Recent Plans</h2>
            <a href="/plans" class="text-sm font-medium text-primary-600 transition hover:text-primary-500 dark:text-primary-300 dark:hover:text-primary-200">View all plans →</a>
          </div>
          <div class="space-y-3">
            {#if recentPlans.length > 0}
              {#each recentPlans as plan (plan.id)}
                {@const progress = completionForPlan(plan)}
                <div class="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <p class="font-medium text-zinc-900 dark:text-zinc-100">{plan.name}</p>
                    <div class="flex items-center gap-2">
                      <Badge variant={statusMeta[plan.status].variant} size="sm" dot>{statusMeta[plan.status].label}</Badge>
                      <span class="text-xs text-zinc-500 dark:text-zinc-400">{toRelativeTime(plan.updated_at)}</span>
                    </div>
                  </div>
                  <div class="mt-3"><Progress value={progress} variant={plan.status === 'done' ? 'success' : 'primary'} size="sm" /></div>
                </div>
              {/each}
            {:else}
              <div class="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
                No plans found.
              </div>
            {/if}
          </div>
        </div>
      {/snippet}
    </Card>
  </section>
</div>
