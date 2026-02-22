<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    description?: string;
    children?: Snippet;
  }

  let { title, description, children }: Props = $props();
</script>

<div
  class="mb-6 flex flex-col gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-800 sm:flex-row sm:items-end sm:justify-between"
>
  <div class="min-w-0">
    <h1 class="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
      {title}
    </h1>
    {#if description}
      <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
    {/if}
  </div>

  {#if children}
    <div class="shrink-0">{@render children()}</div>
  {/if}
</div>
