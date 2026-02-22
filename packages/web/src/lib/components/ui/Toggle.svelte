<script lang="ts">
  interface Props {
    checked?: boolean;
    label?: string;
    disabled?: boolean;
    size?: 'sm' | 'md';
    onchange?: (checked: boolean) => void;
  }

  let { checked = $bindable(false), label, disabled = false, size = 'md', onchange }: Props = $props();
  const sizes = { sm: { track: 'h-5 w-9', thumb: 'h-4 w-4', move: 'translate-x-4' }, md: { track: 'h-6 w-11', thumb: 'h-5 w-5', move: 'translate-x-5' } };
  const toggle = () => { if (disabled) return; checked = !checked; onchange?.(checked); };
</script>

<label class="inline-flex items-center gap-2">
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    {disabled}
    onclick={toggle}
    class={`relative rounded-full transition ${sizes[size].track} ${checked ? 'bg-primary-600 dark:bg-primary-500' : 'bg-surface-300 dark:bg-surface-700'} disabled:opacity-50`}
  >
    <span class={`absolute left-0.5 top-0.5 rounded-full bg-white shadow transition dark:bg-surface-100 ${sizes[size].thumb} ${checked ? sizes[size].move : ''}`}></span>
  </button>
  {#if label}<span class="text-sm text-surface-700 dark:text-surface-200">{label}</span>{/if}
</label>
