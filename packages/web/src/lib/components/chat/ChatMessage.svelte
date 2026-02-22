<script lang="ts">
  import { Bot } from 'lucide-svelte';

  interface ToolCall {
    name?: string;
    status?: string;
    [key: string]: unknown;
  }
  interface Props {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    toolCalls?: ToolCall[];
  }

  let { role, content, timestamp, toolCalls = [] }: Props = $props();
  let now = $state(Date.now());
  let copiedCode = $state<string | null>(null);

  const isUser = $derived(role === 'user');
  const relativeTime = $derived(formatRelative(timestamp, now));
  const htmlContent = $derived(renderMarkdown(content));

  $effect(() => {
    const intervalId = window.setInterval(() => (now = Date.now()), 30000);
    return () => window.clearInterval(intervalId);
  });

  function formatRelative(time: number, current: number): string {
    const seconds = Math.max(1, Math.floor((current - time) / 1000));
    if (seconds < 15) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function escapeHtml(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

  function inlineFormat(value: string): string {
    return value.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code class="rounded bg-slate-900/90 px-1 py-0.5 font-mono text-xs text-slate-100">$1</code>');
  }

  function renderMarkdown(markdown: string): string {
    const blocks: { code: string; lang: string }[] = [];
    const placeholderText = markdown.replace(/```([\w-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const idx = blocks.push({ code, lang: lang ?? '' }) - 1;
      return `\n@@CODEBLOCK_${idx}@@\n`;
    });

    const html: string[] = [];
    let listMode: '' | 'ul' | 'ol' = '';
    const closeList = () => {
      if (!listMode) return;
      html.push(listMode === 'ul' ? '</ul>' : '</ol>');
      listMode = '';
    };

    for (const line of escapeHtml(placeholderText).split('\n')) {
      const trimmed = line.trim();
      const codeMatch = trimmed.match(/^@@CODEBLOCK_(\d+)@@$/);
      if (codeMatch) {
        closeList();
        const block = blocks[Number(codeMatch[1])];
        const key = `${codeMatch[1]}-${block.code.length}`;
        const lang = block.lang ? `<span class="text-[10px] uppercase tracking-wide text-slate-400">${escapeHtml(block.lang)}</span>` : '';
        html.push(`<div class="group my-3 overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
          <div class="flex items-center justify-between border-b border-slate-800 px-3 py-1.5">
            ${lang}<button type="button" data-copy-key="${key}" data-code="${encodeURIComponent(block.code)}" class="copy-code-btn rounded px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800">${copiedCode === key ? 'Copied' : 'Copy'}</button>
          </div><pre class="overflow-x-auto p-3 text-xs text-slate-100"><code>${escapeHtml(block.code)}</code></pre></div>`);
        continue;
      }

      const ul = line.match(/^\s*[-*]\s+(.+)/);
      const ol = line.match(/^\s*\d+\.\s+(.+)/);
      if (ul) {
        if (listMode !== 'ul') closeList(), html.push('<ul class="my-2 list-disc space-y-1 pl-5">'), (listMode = 'ul');
        html.push(`<li>${inlineFormat(ul[1])}</li>`);
        continue;
      }
      if (ol) {
        if (listMode !== 'ol') closeList(), html.push('<ol class="my-2 list-decimal space-y-1 pl-5">'), (listMode = 'ol');
        html.push(`<li>${inlineFormat(ol[1])}</li>`);
        continue;
      }

      closeList();
      if (trimmed) html.push(`<p class="my-2">${inlineFormat(trimmed)}</p>`);
    }
    closeList();
    return html.join('');
  }

  async function onContentClick(event: MouseEvent): Promise<void> {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.copy-code-btn');
    if (!button) return;
    const raw = button.dataset.code ? decodeURIComponent(button.dataset.code) : '';
    if (!raw) return;
    await navigator.clipboard.writeText(raw);
    copiedCode = button.dataset.copyKey ?? raw;
    setTimeout(() => copiedCode === (button.dataset.copyKey ?? raw) && (copiedCode = null), 1500);
  }
</script>

<div class={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
  <div class={`flex max-w-[85%] gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
    {#if !isUser}
      <div class="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200"><Bot size={16} /></div>
    {/if}
    <div class={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${isUser ? 'border-violet-600 bg-violet-600 text-white dark:border-violet-500 dark:bg-violet-500' : 'border-surface-200 bg-white text-surface-800 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-100'}`}>
      <div class="leading-relaxed" onclick={onContentClick}>{@html htmlContent}</div>
      {#if toolCalls.length}
        <div class="mt-2 flex flex-wrap gap-1.5">
          {#each toolCalls as tool, idx}
            <span class={`rounded-full px-2 py-0.5 text-[11px] ${isUser ? 'bg-white/20 text-white' : 'bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300'}`}>
              {tool.name ?? `tool-${idx + 1}`}{tool.status ? ` · ${tool.status}` : ''}
            </span>
          {/each}
        </div>
      {/if}
      <div class={`mt-1 text-[11px] ${isUser ? 'text-violet-100' : 'text-surface-500 dark:text-surface-400'}`}>{relativeTime}</div>
    </div>
  </div>
</div>
