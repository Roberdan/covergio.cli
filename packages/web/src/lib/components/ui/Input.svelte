<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    type?: 'text' | 'email' | 'password' | 'search' | 'number';
    label?: string;
    placeholder?: string;
    error?: string;
    disabled?: boolean;
    value?: string | number;
    leading?: Snippet;
    trailing?: Snippet;
    oninput?: (event: Event) => void;
  }

  let { type = 'text', label, placeholder = '', error, disabled = false, value = $bindable(''), leading, trailing, oninput }: Props = $props();
  const id = `input-${Math.random().toString(36).slice(2, 9)}`;
</script>

<div class="space-y-1">
  {#if label}<label for={id} class="block text-sm font-medium text-surface-700 dark:text-surface-200">{label}</label>{/if}
  <div class={`flex items-center gap-2 rounded-lg border bg-white px-3 transition dark:bg-surface-900 ${error ? 'border-red-500 dark:border-red-400' : 'border-surface-300 focus-within:border-primary-500 dark:border-surface-700 dark:focus-within:border-primary-400'}`}>
    {#if leading}<span class="text-surface-500 dark:text-surface-400">{@render leading()}</span>{/if}
    <input
      {id}
      {type}
      bind:value
      {placeholder}
      {disabled}
      {oninput}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-error` : undefined}
      class="w-full bg-transparent py-2 text-sm text-surface-900 outline-none placeholder:text-surface-400 dark:text-surface-100 dark:placeholder:text-surface-500 disabled:cursor-not-allowed"
    />
    {#if trailing}<span class="text-surface-500 dark:text-surface-400">{@render trailing()}</span>{/if}
  </div>
  {#if error}<p id={id + '-error'} class="text-xs text-red-600 dark:text-red-400">{error}</p>{/if}
</div>
