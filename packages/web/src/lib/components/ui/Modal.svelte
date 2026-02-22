<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    open: boolean;
    title?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    closeOnBackdrop?: boolean;
    onclose?: () => void;
    children: Snippet;
  }

  let { open, title = 'Modal', size = 'md', closeOnBackdrop = true, onclose, children }: Props = $props();
  let panel: HTMLDivElement | null = null;
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  const selector = 'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';
  const focusables = () => (panel ? Array.from(panel.querySelectorAll<HTMLElement>(selector)) : []);

  $effect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => focusables()[0]?.focus(), 0);
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onclose?.();
      if (event.key !== 'Tab') return;
      const els = focusables(); if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeydown);
    return () => { clearTimeout(timer); document.removeEventListener('keydown', onKeydown); previous?.focus(); };
  });
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    role="presentation"
    onclick={(event) => closeOnBackdrop && event.currentTarget === event.target && onclose?.()}
  >
    <div bind:this={panel} role="dialog" aria-modal="true" aria-label={title} class={`w-full rounded-xl bg-white text-surface-900 shadow-xl dark:bg-surface-900 dark:text-surface-100 ${sizes[size]}`}>
      <header class="flex items-center justify-between border-b border-surface-200 px-5 py-4 dark:border-surface-700">
        <h2 class="text-lg font-semibold">{title}</h2><button class="rounded p-1 hover:bg-surface-100 dark:hover:bg-surface-800" onclick={() => onclose?.()} aria-label="Close modal">✕</button>
      </header>
      <div class="p-5">{@render children()}</div>
    </div>
  </div>
{/if}
