<script lang="ts">
  import { ChevronDown, ChevronRight } from 'lucide-svelte';

  interface TreeItemData {
    status?: string;
    [key: string]: unknown;
  }

  interface TreeItem {
    label: string;
    children?: TreeItem[];
    data?: TreeItemData;
  }

  interface TreeViewProps {
    items: TreeItem[];
  }

  let { items = [] }: TreeViewProps = $props();

  let expandedNodes = $state<Set<string>>(new Set());

  const hasChildren = (node: TreeItem) => (node.children?.length ?? 0) > 0;
  const isExpanded = (path: string) => expandedNodes.has(path);

  const toggleNode = (path: string) => {
    const next = new Set(expandedNodes);

    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }

    expandedNodes = next;
  };

  const statusClass = (status: string | undefined) => {
    switch (status) {
      case 'done':
      case 'completed':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
      case 'blocked':
        return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
      case 'in_progress':
      case 'in-progress':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
    }
  };
</script>

<div class="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
  {#snippet renderNodes(nodes: TreeItem[], depth: number, parentPath: string)}
    {#each nodes as node, index (`${parentPath}-${index}-${node.label}`)}
      {@const path = `${parentPath}.${index}`}
      <div class="relative">
        <div
          class="group relative flex items-center gap-2 rounded-md py-1.5 pr-2 hover:bg-slate-50 dark:hover:bg-slate-800/70"
          style={`padding-left: ${depth * 1.2 + 0.6}rem;`}
        >
          {#if depth > 0}
            <span
              class="pointer-events-none absolute left-2 top-0 h-full w-px bg-slate-200 dark:bg-slate-700"
              aria-hidden="true"
            ></span>
          {/if}

          <button
            type="button"
            class="flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            onclick={() => hasChildren(node) && toggleNode(path)}
            aria-label={hasChildren(node) ? 'Toggle node' : 'Tree node'}
          >
            {#if hasChildren(node)}
              {#if isExpanded(path)}
                <ChevronDown class="h-4 w-4" />
              {:else}
                <ChevronRight class="h-4 w-4" />
              {/if}
            {/if}
          </button>

          <span class="text-sm text-slate-700 dark:text-slate-100">{node.label}</span>

          {#if node.data?.status}
            <span
              class={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(node.data.status)}`}
            >
              {node.data.status}
            </span>
          {/if}
        </div>

        {#if hasChildren(node) && isExpanded(path)}
          <div class="ml-2 border-l border-slate-200 pl-1 dark:border-slate-700">
            {@render renderNodes(node.children ?? [], depth + 1, path)}
          </div>
        {/if}
      </div>
    {/each}
  {/snippet}

  {@render renderNodes(items, 0, 'root')}
</div>
