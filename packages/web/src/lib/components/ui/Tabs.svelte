<script lang="ts">
  interface TabItem { label: string; value: string }
  interface Props {
    items: TabItem[];
    active?: string;
    onchange?: (value: string) => void;
  }

  let { items, active = $bindable(''), onchange }: Props = $props();
  $effect(() => { if (!active && items[0]) active = items[0].value; });
  const select = (value: string) => { active = value; onchange?.(value); };
</script>

<div role="tablist" class="inline-flex rounded-lg bg-surface-100 p-1 dark:bg-surface-800">
  {#each items as item}
    <button
      role="tab"
      aria-selected={active === item.value}
      class={`rounded-md px-3 py-1.5 text-sm font-medium transition ${active === item.value ? 'bg-white text-surface-900 shadow dark:bg-surface-700 dark:text-surface-100' : 'text-surface-600 hover:text-surface-900 dark:text-surface-300 dark:hover:text-surface-100'}`}
      onclick={() => select(item.value)}
    >
      {item.label}
    </button>
  {/each}
</div>
