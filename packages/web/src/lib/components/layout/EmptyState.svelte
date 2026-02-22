<script lang="ts">
  import type { Component, Snippet } from 'svelte';

  interface Props {
    icon: Component<{ class?: string }>;
    title: string;
    description: string;
    children?: Snippet;
  }

  let { icon: Icon, title, description, children }: Props = $props();
</script>

<div class="flex min-h-[320px] items-center justify-center px-4 py-10">
  <div
    class="w-full max-w-lg rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/40"
  >
    <div
      class="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-white text-zinc-400 shadow-sm dark:bg-zinc-800 dark:text-zinc-500"
    >
      <Icon class="h-7 w-7" />
    </div>

    <h2 class="text-lg font-semibold text-zinc-800 dark:text-zinc-200">{title}</h2>
    <p class="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">{description}</p>

    {#if children}
      <div class="mt-6 flex justify-center">{@render children()}</div>
    {/if}
  </div>
</div>
