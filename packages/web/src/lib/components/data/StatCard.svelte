<script lang="ts">
  import { ArrowDownRight, ArrowUpRight, Circle } from 'lucide-svelte';
  import * as LucideIcons from 'lucide-svelte';

  type ColorVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger';

  interface StatCardProps {
    value: string | number;
    label: string;
    trend?: number;
    icon?: string;
    variant?: ColorVariant;
  }

  let { value, label, trend, icon = 'Circle', variant = 'default' }: StatCardProps = $props();

  const variantStyles: Record<ColorVariant, { card: string; icon: string }> = {
    default: {
      card: 'border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
      icon: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
    },
    primary: {
      card: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-100',
      icon: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
    },
    success: {
      card: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100',
      icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200'
    },
    warning: {
      card: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100',
      icon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200'
    },
    danger: {
      card: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-100',
      icon: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200'
    }
  };

  type LucideComponent = typeof Circle;

  const resolveIcon = (name: string): LucideComponent => {
    const icons = LucideIcons as Record<string, LucideComponent>;
    return icons[name] ?? Circle;
  };

  const IconComponent = $derived(resolveIcon(icon));
</script>

<div class={`rounded-xl border p-4 shadow-sm transition sm:p-5 ${variantStyles[variant].card}`}>
  <div class="flex items-start justify-between gap-4">
    <div>
      <p class="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p class="mt-1 text-2xl font-bold sm:text-3xl">{value}</p>
    </div>
    <div class={`rounded-lg p-2 ${variantStyles[variant].icon}`}>
      <IconComponent class="h-5 w-5" />
    </div>
  </div>

  {#if trend !== undefined}
    <div class="mt-4 flex items-center gap-1 text-sm font-medium">
      {#if trend >= 0}
        <ArrowUpRight class="h-4 w-4 text-emerald-500" />
        <span class="text-emerald-600 dark:text-emerald-400">+{trend}%</span>
      {:else}
        <ArrowDownRight class="h-4 w-4 text-rose-500" />
        <span class="text-rose-600 dark:text-rose-400">{trend}%</span>
      {/if}
      <span class="text-slate-500 dark:text-slate-400">vs last period</span>
    </div>
  {/if}
</div>
