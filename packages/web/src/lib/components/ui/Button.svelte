<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'xs' | 'sm' | 'md' | 'lg';
    disabled?: boolean;
    loading?: boolean;
    type?: 'button' | 'submit' | 'reset';
    onclick?: (event: MouseEvent) => void;
    children: Snippet;
  }

  let { variant = 'primary', size = 'md', disabled = false, loading = false, type = 'button', onclick, children }: Props = $props();
  const sizeClasses = { xs: 'px-2 py-1 text-xs', sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  const variantClasses = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600',
    secondary: 'bg-surface-200 text-surface-900 hover:bg-surface-300 dark:bg-surface-700 dark:text-surface-100 dark:hover:bg-surface-600',
    outline: 'border border-primary-600 text-primary-600 hover:bg-primary-50 dark:border-primary-400 dark:text-primary-400 dark:hover:bg-primary-950',
    ghost: 'text-surface-700 hover:bg-surface-100 dark:text-surface-200 dark:hover:bg-surface-800',
    danger: 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600'
  };
</script>

<button
  {type}
  {onclick}
  disabled={disabled || loading}
  aria-disabled={disabled || loading}
  aria-busy={loading}
  class={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-900 disabled:cursor-not-allowed disabled:opacity-50 ${sizeClasses[size]} ${variantClasses[variant]}`}
>
  {#if loading}
    <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
    </svg>
  {/if}
  {@render children()}
</button>
