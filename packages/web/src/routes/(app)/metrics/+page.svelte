<script lang="ts">
  import type { PageData } from './$types';
  import { PageHeader } from '$components/layout';
  import Card from '$components/ui/Card.svelte';
  import StatCard from '$components/data/StatCard.svelte';
  import LineChart from '$components/charts/LineChart.svelte';
  import BarChart from '$components/charts/BarChart.svelte';
  import DataTable from '$components/data/DataTable.svelte';

  type RangeValue = '7d' | '30d' | '90d';

  const rangeButtons: Array<{ label: string; value: RangeValue }> = [
    { label: '7d', value: '7d' },
    { label: '30d', value: '30d' },
    { label: '90d', value: '90d' }
  ];

  const mockTimeline = Array.from({ length: 30 }, (_, index) => ({
    label: `Day ${index + 1}`,
    value: 6 + ((index * 3) % 11)
  }));

  const topAgents = [
    { name: 'planner', invocations: 128, model: 'claude-opus-4.6-1m', category: 'Leadership' },
    { name: 'execute', invocations: 102, model: 'gpt-5.3-codex', category: 'Technical' },
    { name: 'code-reviewer', invocations: 94, model: 'claude-opus-4.6', category: 'Compliance' },
    { name: 'tdd-executor', invocations: 88, model: 'gpt-5.3-codex', category: 'Core Utility' },
    { name: 'prompt', invocations: 76, model: 'claude-opus-4.6', category: 'Business' }
  ];

  const tableColumns = [
    { key: 'name', label: 'Agent', sortable: true },
    { key: 'invocations', label: 'Invocations', sortable: true },
    { key: 'model', label: 'Model', sortable: true },
    { key: 'category', label: 'Category', sortable: true }
  ];

  let { data }: { data: PageData } = $props();
  let activeRange = $state<RangeValue>('30d');

  const rangeSize = $derived.by(() => {
    if (activeRange === '7d') {
      return 7;
    }
    return 30;
  });

  const lineLabels = $derived.by(() => mockTimeline.slice(-rangeSize).map((point) => point.label));
  const lineValues = $derived.by(() => mockTimeline.slice(-rangeSize).map((point) => point.value));

  const priorityDistribution = $derived.by(() => {
    const scale = activeRange === '7d' ? 0.35 : activeRange === '90d' ? 1.2 : 1;
    return [
      Math.round(18 * scale),
      Math.round(42 * scale),
      Math.round(61 * scale),
      Math.round(33 * scale)
    ];
  });

  const tableRows = $derived.by(() => {
    const scale = activeRange === '7d' ? 0.4 : activeRange === '90d' ? 1.25 : 1;
    return topAgents.map((agent) => ({
      ...agent,
      invocations: Math.round(agent.invocations * scale)
    }));
  });
</script>

<section class="space-y-6">
  <PageHeader title="Metrics & Analytics" />

  <div class="inline-flex rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900">
    {#each rangeButtons as range}
      <button
        type="button"
        class={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
          activeRange === range.value
            ? 'bg-violet-600 text-white'
            : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white'
        }`}
        onclick={() => (activeRange = range.value)}
      >
        {range.label}
      </button>
    {/each}
  </div>

  <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
    <StatCard
      label="Total Tasks"
      value={data.metrics.totalTasks}
      trend={12}
      icon="ListChecks"
      variant="primary"
    />
    <StatCard
      label="Completion Rate"
      value={`${data.metrics.completionRate}%`}
      trend={4}
      icon="CheckCircle2"
      variant="success"
    />
    <StatCard
      label="Active Plans"
      value={data.metrics.activePlans}
      trend={-2}
      icon="FolderKanban"
      variant="warning"
    />
  </div>

  <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
    <Card variant="bordered">
      <h2 class="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Tasks completed over time</h2>
      <LineChart
        labels={lineLabels}
        datasets={[{ label: 'Completed tasks', data: lineValues, color: '#7c3aed' }]}
        showArea={true}
      />
    </Card>

    <Card variant="bordered">
      <h2 class="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Priority distribution</h2>
      <BarChart
        labels={['P0', 'P1', 'P2', 'P3']}
        datasets={[{ label: 'Tasks', data: priorityDistribution, color: '#3b82f6' }]}
      />
    </Card>
  </div>

  <Card variant="bordered">
    <h2 class="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Top agents by usage</h2>
    <DataTable columns={tableColumns} rows={tableRows} sortBy="invocations" sortDir="desc" />
  </Card>
</section>
