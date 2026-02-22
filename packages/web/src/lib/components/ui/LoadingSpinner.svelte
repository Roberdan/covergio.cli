<script lang="ts">
  interface Props {
    size?: 'sm' | 'md' | 'lg';
    color?: 'primary' | 'neutral' | 'white';
  }

  let { size = 'md', color = 'primary' }: Props = $props();
  const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };
  const colors = {
    primary: 'text-primary-600 dark:text-primary-400',
    neutral: 'text-surface-600 dark:text-surface-300',
    white: 'text-white dark:text-surface-100'
  };
</script>

<svg class={`animate-spin ${sizes[size]} ${colors[color]}`} viewBox="0 0 24 24" role="status" aria-label="Loading">
  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
</svg>
