<script lang="ts">
  interface Props { text?: string }
  let { text = 'Agent is thinking...' }: Props = $props();
  let mounted = $state(false);
  const label = $derived(mounted ? text : text);
  $effect(() => {
    mounted = true;
    return () => {
      mounted = false;
    };
  });
</script>

<div class="inline-flex items-center gap-2 rounded-full border border-surface-200 bg-white px-3 py-1.5 text-xs text-surface-600 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-300">
  <div class="flex items-center gap-1" aria-hidden="true">
    <span class="h-1.5 w-1.5 animate-[bounce_1s_infinite] rounded-full bg-surface-400 dark:bg-surface-500"></span>
    <span class="h-1.5 w-1.5 animate-[bounce_1s_infinite_150ms] rounded-full bg-surface-400 dark:bg-surface-500"></span>
    <span class="h-1.5 w-1.5 animate-[bounce_1s_infinite_300ms] rounded-full bg-surface-400 dark:bg-surface-500"></span>
  </div>
  <span>{label}</span>
</div>
