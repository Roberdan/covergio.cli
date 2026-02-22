<script lang="ts">
  import { AlertTriangle, RotateCcw } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    children?: Snippet;
    title?: string;
    description?: string;
  }

  let {
    children,
    title = 'Something went wrong',
    description = 'An unexpected error occurred while loading this content.'
  }: Props = $props();
</script>

<svelte:boundary>
  {@render children?.()}

  {#snippet failed(error, reset)}
    <div class="rounded-xl border border-red-200 bg-red-50/70 p-6 text-center dark:border-red-900/40 dark:bg-red-950/30">
      <div
        class="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300"
      >
        <AlertTriangle class="h-6 w-6" />
      </div>

      <h2 class="text-lg font-semibold text-red-900 dark:text-red-200">{title}</h2>
      <p class="mt-2 text-sm text-red-700 dark:text-red-300">{description}</p>

      {#if error instanceof Error}
        <p class="mt-2 text-xs text-red-600 dark:text-red-400">{error.message}</p>
      {/if}

      <button
        type="button"
        class="mt-5 inline-flex items-center gap-2 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
        onclick={reset}
      >
        <RotateCcw class="h-4 w-4" />
        Retry
      </button>
    </div>
  {/snippet}
</svelte:boundary>
