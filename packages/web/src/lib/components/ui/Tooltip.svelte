<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    position?: 'top' | 'bottom' | 'left' | 'right';
    content: string;
    delay?: number;
    children: Snippet;
  }

  let { position = 'top', content, delay = 150, children }: Props = $props();
  let visible = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const positions = {
    top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
    bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
    left: 'right-full top-1/2 mr-2 -translate-y-1/2',
    right: 'left-full top-1/2 ml-2 -translate-y-1/2'
  };
  const show = () => { clearTimeout(timer); timer = setTimeout(() => (visible = true), delay); };
  const hide = () => { clearTimeout(timer); visible = false; };
</script>

<span class="relative inline-flex" onmouseenter={show} onmouseleave={hide} onfocusin={show} onfocusout={hide}>
  {@render children()}
  {#if visible}
    <span role="tooltip" class={`pointer-events-none absolute z-40 whitespace-nowrap rounded bg-surface-900 px-2 py-1 text-xs text-white dark:bg-surface-100 dark:text-surface-900 ${positions[position]}`}>
      {content}
    </span>
  {/if}
</span>
