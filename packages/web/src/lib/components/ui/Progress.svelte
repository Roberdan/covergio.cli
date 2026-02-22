<script lang="ts">
  interface Props {
    value: number;
    variant?: 'primary' | 'success' | 'warning' | 'error';
    size?: 'sm' | 'md' | 'lg';
    label?: string;
    animated?: boolean;
  }

  let { value, variant = 'primary', size = 'md', label, animated = false }: Props = $props();
  const clamped = () => Math.max(0, Math.min(100, value));
  const track = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-3.5' };
  const fill = {
    primary: 'bg-primary-600 dark:bg-primary-500',
    success: 'bg-emerald-600 dark:bg-emerald-500',
    warning: 'bg-amber-500 dark:bg-amber-400',
    error: 'bg-red-600 dark:bg-red-500'
  };
</script>

<div class="space-y-1">
  {#if label}<div class="flex justify-between text-sm text-surface-700 dark:text-surface-200"><span>{label}</span><span>{clamped()}%</span></div>{/if}
  <div class={`w-full overflow-hidden rounded-full bg-surface-200 dark:bg-surface-700 ${track[size]}`} role="progressbar" aria-valuenow={clamped()} aria-valuemin="0" aria-valuemax="100">
    <div class={`h-full rounded-full transition-all duration-300 ${fill[variant]} ${animated ? 'animate-pulse' : ''}`} style={`width:${clamped()}%`}></div>
  </div>
</div>
