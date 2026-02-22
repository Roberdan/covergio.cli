<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'default' | 'bordered' | 'elevated';
    padding?: 'none' | 'sm' | 'md' | 'lg';
    header?: Snippet;
    footer?: Snippet;
    children: Snippet;
  }

  let { variant = 'default', padding = 'md', header, footer, children }: Props = $props();
  const variantClasses = {
    default: 'bg-white dark:bg-surface-900',
    bordered: 'border border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-900',
    elevated: 'bg-white shadow-lg shadow-surface-900/5 dark:bg-surface-900 dark:shadow-black/30'
  };
  const paddingClasses = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-7' };
</script>

<article class={`rounded-xl ${variantClasses[variant]}`}>
  {#if header}<header class="border-b border-surface-200 p-4 dark:border-surface-700">{@render header()}</header>{/if}
  <div class={paddingClasses[padding]}>{@render children()}</div>
  {#if footer}<footer class="border-t border-surface-200 p-4 dark:border-surface-700">{@render footer()}</footer>{/if}
</article>
