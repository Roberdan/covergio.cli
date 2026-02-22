<script lang="ts">
  import { ChevronDown, ChevronRight, Terminal, FileCode, Search, Play, CheckCircle, XCircle, Clock } from 'lucide-svelte';

  interface ToolCall {
    id: string;
    name: string;
    params: Record<string, unknown>;
    status: 'pending' | 'running' | 'complete' | 'error';
    result?: string;
    startedAt?: number;
    completedAt?: number;
  }

  interface ToolCallPanelProps {
    toolCalls?: ToolCall[];
    visible?: boolean;
    ontoggle?: () => void;
  }

  let { toolCalls = [], visible = true, ontoggle }: ToolCallPanelProps = $props();
  let expandedIds = $state<Set<string>>(new Set());

  function toggleExpand(id: string) {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    expandedIds = next;
  }

  const toolIcons: Record<string, typeof Terminal> = {
    'read-file': FileCode,
    'write-file': FileCode,
    'edit': FileCode,
    'shell': Terminal,
    'grep': Search,
    'glob': Search
  };

  const statusColors: Record<string, string> = {
    pending: 'text-zinc-400',
    running: 'text-amber-500 animate-pulse',
    complete: 'text-emerald-500',
    error: 'text-red-500'
  };

  function formatDuration(start?: number, end?: number): string {
    if (!start) return '';
    const ms = (end ?? Date.now()) - start;
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  }

  function formatParams(params: Record<string, unknown>): string {
    return JSON.stringify(params, null, 2);
  }
</script>

{#if visible && toolCalls.length > 0}
  <aside class="w-80 shrink-0 border-l border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
    <div class="flex items-center justify-between border-b border-zinc-200 p-3 dark:border-zinc-800">
      <h3 class="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Tool Calls</h3>
      <span class="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
        {toolCalls.length}
      </span>
    </div>

    <div class="overflow-y-auto p-2" style="max-height: calc(100vh - 8rem)">
      {#each toolCalls as call (call.id)}
        <div class="mb-2 rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <button
            type="button"
            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
            onclick={() => toggleExpand(call.id)}
          >
            {#if expandedIds.has(call.id)}
              <ChevronDown class="h-3 w-3 shrink-0 text-zinc-400" />
            {:else}
              <ChevronRight class="h-3 w-3 shrink-0 text-zinc-400" />
            {/if}

            <Terminal class="h-4 w-4 shrink-0 text-violet-500" />

            <span class="flex-1 truncate font-medium text-zinc-800 dark:text-zinc-200">
              {call.name}
            </span>

            {#if call.status === 'complete'}
              <CheckCircle class="h-4 w-4 {statusColors[call.status]}" />
            {:else if call.status === 'error'}
              <XCircle class="h-4 w-4 {statusColors[call.status]}" />
            {:else if call.status === 'running'}
              <Play class="h-4 w-4 {statusColors[call.status]}" />
            {:else}
              <Clock class="h-4 w-4 {statusColors[call.status]}" />
            {/if}
          </button>

          {#if expandedIds.has(call.id)}
            <div class="border-t border-zinc-100 px-3 py-2 dark:border-zinc-800">
              <p class="mb-1 text-xs font-medium text-zinc-500">Parameters</p>
              <pre class="overflow-x-auto rounded bg-zinc-100 p-2 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{formatParams(call.params)}</pre>

              {#if call.result}
                <p class="mb-1 mt-2 text-xs font-medium text-zinc-500">Result</p>
                <pre class="max-h-40 overflow-auto rounded bg-zinc-900 p-2 text-xs text-green-400">{call.result}</pre>
              {/if}

              {#if call.startedAt}
                <p class="mt-2 text-xs text-zinc-400">
                  Duration: {formatDuration(call.startedAt, call.completedAt)}
                </p>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </aside>
{/if}
