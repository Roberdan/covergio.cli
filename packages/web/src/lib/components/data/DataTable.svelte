<script lang="ts">
  import { ChevronDown, ChevronRight, ChevronsUpDown } from 'lucide-svelte';
  import Badge from '$components/ui/Badge.svelte';

  type SortDir = 'asc' | 'desc';
  type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary';

  interface BadgeCell {
    type: 'badge';
    label: string;
    variant?: BadgeVariant;
    size?: 'sm' | 'md';
    dot?: boolean;
  }

  interface LinkCell {
    type: 'link';
    label: string;
    href: string;
  }

  interface DataColumn {
    key: string;
    label: string;
    sortable?: boolean;
    width?: string;
  }

  interface DataTableProps {
    columns: DataColumn[];
    rows: Record<string, unknown>[];
    sortBy?: string;
    sortDir?: SortDir;
  }

  let { columns = [], rows = [], sortBy = '', sortDir = 'asc' }: DataTableProps = $props();

  let search = $state('');
  let currentSortBy = $state(sortBy);
  let currentSortDir = $state<SortDir>(sortDir);
  let page = $state(1);
  let pageSize = $state(10);
  let expandedRows = $state<Set<string>>(new Set());

  const cellText = (value: unknown): string => {
    if (typeof value === 'object' && value !== null && 'label' in value) {
      return String((value as { label: unknown }).label ?? '');
    }

    return String(value ?? '');
  };

  const asComparable = (value: unknown) => {
    if (typeof value === 'number') {
      return value;
    }

    if (value instanceof Date) {
      return value.getTime();
    }

    return cellText(value).toLowerCase();
  };

  const rowKey = (row: Record<string, unknown>, index: number) => String(row.id ?? index);
  const isBadgeCell = (value: unknown): value is BadgeCell =>
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'badge' &&
    'label' in value;
  const isLinkCell = (value: unknown): value is LinkCell =>
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    value.type === 'link' &&
    'href' in value &&
    'label' in value;

  const filteredRows = $derived.by(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return rows;
    }

    return rows.filter((row) =>
      columns.some((column) => cellText(row[column.key]).toLowerCase().includes(query))
    );
  });

  const sortedRows = $derived.by(() => {
    if (!currentSortBy) {
      return filteredRows;
    }

    return [...filteredRows].sort((rowA, rowB) => {
      const valueA = asComparable(rowA[currentSortBy]);
      const valueB = asComparable(rowB[currentSortBy]);

      if (valueA < valueB) {
        return currentSortDir === 'asc' ? -1 : 1;
      }

      if (valueA > valueB) {
        return currentSortDir === 'asc' ? 1 : -1;
      }

      return 0;
    });
  });

  const totalPages = $derived.by(() => Math.max(1, Math.ceil(sortedRows.length / pageSize)));

  const pagedRows = $derived.by(() => {
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  });

  const toggleSort = (column: DataColumn) => {
    if (!column.sortable) {
      return;
    }

    if (currentSortBy === column.key) {
      currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      currentSortBy = column.key;
      currentSortDir = 'asc';
    }

    page = 1;
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expandedRows);

    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }

    expandedRows = next;
  };

  $effect(() => {
    currentSortBy = sortBy;
    currentSortDir = sortDir;
  });

  $effect(() => {
    if (page > totalPages) {
      page = totalPages;
    }
  });
</script>

<div class="space-y-4">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <label class="relative w-full sm:max-w-sm">
      <span class="sr-only">Filter rows</span>
      <input
        class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-blue-500 transition placeholder:text-slate-400 focus:ring dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        type="text"
        placeholder="Filter table..."
        bind:value={search}
      />
    </label>

    <div class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
      <label for="page-size">Rows</label>
      <select
        id="page-size"
        class="rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
        bind:value={pageSize}
      >
        {#each [5, 10, 25, 50] as size}
          <option value={size}>{size}</option>
        {/each}
      </select>
    </div>
  </div>

  <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
    <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
      <thead class="bg-slate-50 dark:bg-slate-900">
        <tr>
          <th class="w-10 px-3 py-2"></th>
          {#each columns as column}
            <th
              class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300"
              style={column.width ? `width: ${column.width};` : ''}
            >
              <button
                class="inline-flex items-center gap-1 disabled:cursor-default"
                type="button"
                disabled={!column.sortable}
                onclick={() => toggleSort(column)}
              >
                {column.label}
                {#if column.sortable}
                  <ChevronsUpDown class="h-3.5 w-3.5" />
                {/if}
              </button>
            </th>
          {/each}
        </tr>
      </thead>

      <tbody class="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
        {#if pagedRows.length === 0}
          <tr>
            <td
              colspan={columns.length + 1}
              class="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
            >
              No rows found
            </td>
          </tr>
        {/if}

        {#each pagedRows as row, rowIndex (`${page}-${rowKey(row, rowIndex)}`)}
          {@const key = rowKey(row, rowIndex)}
          <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/60">
            <td class="px-3 py-2 align-top">
              <button
                type="button"
                class="rounded p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                onclick={() => toggleExpand(key)}
                aria-label="Toggle row details"
              >
                {#if expandedRows.has(key)}
                  <ChevronDown class="h-4 w-4" />
                {:else}
                  <ChevronRight class="h-4 w-4" />
                {/if}
              </button>
            </td>

            {#each columns as column}
              {@const value = row[column.key]}
              <td class="px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
                {#if isBadgeCell(value)}
                  <Badge
                    size={value.size ?? 'sm'}
                    variant={value.variant ?? 'default'}
                    dot={value.dot ?? false}
                  >
                    {value.label}
                  </Badge>
                {:else if isLinkCell(value)}
                  <a
                    href={value.href}
                    class="font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {value.label}
                  </a>
                {:else}
                  {value ?? '—'}
                {/if}
              </td>
            {/each}
          </tr>

          {#if expandedRows.has(key)}
            <tr class="bg-slate-50/80 dark:bg-slate-900/50">
              <td colspan={columns.length + 1} class="px-4 py-3">
                <pre class="overflow-x-auto whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300"
                  >{JSON.stringify(row, null, 2)}</pre
                >
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>

  <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <p class="text-sm text-slate-600 dark:text-slate-300">
      Showing {pagedRows.length} of {sortedRows.length} rows
    </p>

    <div class="flex items-center gap-2">
      <button
        type="button"
        class="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-700"
        disabled={page <= 1}
        onclick={() => (page = Math.max(1, page - 1))}
      >
        Previous
      </button>

      <span class="text-sm text-slate-600 dark:text-slate-300">Page {page} / {totalPages}</span>

      <button
        type="button"
        class="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-700"
        disabled={page >= totalPages}
        onclick={() => (page = Math.min(totalPages, page + 1))}
      >
        Next
      </button>
    </div>
  </div>
</div>
