<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary';
    size?: 'sm' | 'md';
    dot?: boolean;
    children: Snippet;
  }

  let { variant = 'default', size = 'md', dot = false, children }: Props = $props();
  const variants = {
    default: 'bg-surface-200 text-surface-800 dark:bg-surface-700 dark:text-surface-100',
    success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    error: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    info: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
    primary: 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-300'
  };
  const sizes = { sm: 'px-2 py-0.5 text-xs', md: 'px-2.5 py-1 text-sm' };
</script>

<span class={`inline-flex items-center gap-1 rounded-full font-medium ${sizes[size]} ${variants[variant]}`}>
  {#if dot}<span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>{/if}
  {@render children()}
</span>
