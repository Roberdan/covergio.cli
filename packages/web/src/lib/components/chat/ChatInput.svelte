<script lang="ts">
  import { ArrowUp } from 'lucide-svelte';

  interface Props {
    onsubmit?: (value: string) => void | Promise<void>;
    disabled?: boolean;
    placeholder?: string;
  }

  let { onsubmit, disabled = false, placeholder = 'Message the agent...' }: Props = $props();
  let value = $state('');
  let textarea = $state<HTMLTextAreaElement | null>(null);

  const canSend = $derived(!disabled && value.trim().length > 0);

  $effect(() => {
    value;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const lineHeight = Number.parseFloat(getComputedStyle(textarea).lineHeight || '24');
    const maxHeight = lineHeight * 6;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  });

  async function submitMessage(): Promise<void> {
    if (!canSend) return;
    const next = value.trim();
    await onsubmit?.(next);
    value = '';
  }

  async function onKeydown(event: KeyboardEvent): Promise<void> {
    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    await submitMessage();
  }
</script>

<form
  class="flex items-end gap-2 rounded-xl border border-surface-200 bg-white p-2 shadow-sm focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-200 dark:border-surface-700 dark:bg-surface-900 dark:focus-within:border-violet-500 dark:focus-within:ring-violet-900/40"
  onsubmit={async (event) => {
    event.preventDefault();
    await submitMessage();
  }}
>
  <textarea
    bind:this={textarea}
    bind:value
    rows={1}
    {disabled}
    {placeholder}
    class="max-h-36 min-h-[2rem] w-full resize-none bg-transparent px-2 py-1 text-sm text-surface-900 outline-none placeholder:text-surface-400 dark:text-surface-100 dark:placeholder:text-surface-500 disabled:cursor-not-allowed"
    onkeydown={onKeydown}
  ></textarea>
  <button
    type="submit"
    disabled={!canSend}
    class={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${canSend ? 'bg-violet-600 text-white hover:bg-violet-500' : 'bg-surface-100 text-surface-400 dark:bg-surface-800 dark:text-surface-500'}`}
    aria-label="Send message"
  >
    <ArrowUp size={16} />
  </button>
</form>
