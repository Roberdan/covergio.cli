<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Item { label: string; value: string; disabled?: boolean; divider?: boolean }
  interface Props {
    items: Item[];
    position?: 'left' | 'right';
    trigger: Snippet;
    onselect?: (value: string) => void;
  }

  let { items, position = 'left', trigger, onselect }: Props = $props();
  let open = $state(false);
  let root: HTMLDivElement | null = null;
  $effect(() => {
    const close = (event: MouseEvent) => root && !root.contains(event.target as Node) && (open = false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  });
</script>

<div bind:this={root} class="relative inline-block text-left">
  <div role="button" tabindex="0" aria-haspopup="menu" onclick={() => (open = !open)}>{@render trigger()}</div>
  {#if open}
    <div class={`absolute z-40 mt-2 min-w-44 rounded-lg border border-surface-200 bg-white p-1 shadow-lg dark:border-surface-700 dark:bg-surface-900 ${position === 'right' ? 'right-0' : 'left-0'}`} role="menu">
      {#each items as item}
        <button
          disabled={item.disabled}
          class={`block w-full rounded px-3 py-2 text-left text-sm text-surface-700 hover:bg-surface-100 dark:text-surface-200 dark:hover:bg-surface-800 ${item.divider ? 'mt-1 border-t border-surface-200 pt-3 dark:border-surface-700' : ''} disabled:opacity-50`}
          onclick={() => { if (!item.disabled) { onselect?.(item.value); open = false; } }}
        >
          {item.label}
        </button>
      {/each}
    </div>
  {/if}
</div>
