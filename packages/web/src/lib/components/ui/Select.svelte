<script lang="ts">
  interface Option { label: string; value: string; disabled?: boolean }
  interface Props {
    options: Option[];
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    error?: string;
    value?: string;
    onchange?: (value: string) => void;
  }

  let { options, label, placeholder = 'Select an option', disabled = false, error, value = $bindable(''), onchange }: Props = $props();
  const id = `select-${Math.random().toString(36).slice(2, 9)}`;
</script>

<div class="space-y-1">
  {#if label}<label for={id} class="block text-sm font-medium text-surface-700 dark:text-surface-200">{label}</label>{/if}
  <select
    {id}
    bind:value
    {disabled}
    aria-invalid={!!error}
    aria-describedby={error ? `${id}-error` : undefined}
    onchange={(event) => onchange?.((event.currentTarget as HTMLSelectElement).value)}
    class={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${error ? 'border-red-500 dark:border-red-400' : 'border-surface-300 focus:border-primary-500 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100 dark:focus:border-primary-400'} disabled:cursor-not-allowed disabled:opacity-60`}
  >
    <option value="" disabled>{placeholder}</option>
    {#each options as option}
      <option value={option.value} disabled={option.disabled}>{option.label}</option>
    {/each}
  </select>
  {#if error}<p id={id + '-error'} class="text-xs text-red-600 dark:text-red-400">{error}</p>{/if}
</div>
