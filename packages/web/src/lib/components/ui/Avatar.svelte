<script lang="ts">
  interface Props {
    src?: string;
    alt?: string;
    fallback?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    status?: 'online' | 'offline' | 'busy';
  }

  let { src, alt = 'Avatar', fallback = 'U', size = 'md', status }: Props = $props();
  let failed = $state(false);
  const sizes = { xs: 'h-6 w-6 text-xs', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base', xl: 'h-16 w-16 text-lg' };
  const statusColor = { online: 'bg-emerald-500', offline: 'bg-surface-400 dark:bg-surface-500', busy: 'bg-red-500' };
  $effect(() => { src; failed = false; });
</script>

<div class="relative inline-flex">
  <div class={`inline-flex items-center justify-center overflow-hidden rounded-full bg-surface-200 font-semibold text-surface-700 dark:bg-surface-700 dark:text-surface-100 ${sizes[size]}`}>
    {#if src && !failed}
      <img src={src} {alt} class="h-full w-full object-cover" onerror={() => (failed = true)} />
    {:else}
      <span>{fallback}</span>
    {/if}
  </div>
  {#if status}
    <span class={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-surface-900 ${statusColor[status]}`} aria-hidden="true"></span>
  {/if}
</div>
