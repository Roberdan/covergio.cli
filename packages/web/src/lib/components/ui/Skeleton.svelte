<script lang="ts">
  interface Props {
    variant?: 'text' | 'circular' | 'rectangular';
    width?: string;
    height?: string;
    count?: number;
  }

  let { variant = 'text', width = '100%', height, count = 1 }: Props = $props();
  const shape = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md'
  };
  const computedHeight = () => height ?? (variant === 'circular' ? width : variant === 'text' ? '1rem' : '4rem');
</script>

<div class="space-y-2">
  {#each Array.from({ length: count }) as _, index}
    <div class={`animate-pulse bg-surface-200 dark:bg-surface-700 ${shape[variant]}`} style={`width:${width};height:${computedHeight()};`} aria-hidden="true"></div>
  {/each}
</div>
