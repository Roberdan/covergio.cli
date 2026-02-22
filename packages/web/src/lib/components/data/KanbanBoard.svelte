<script lang="ts">
  interface KanbanItem {
    id?: string;
    title: string;
    progress?: number;
    badges?: string[];
  }

  interface KanbanColumn {
    id: string;
    title: string;
    items: KanbanItem[];
  }

  interface KanbanBoardProps {
    columns: KanbanColumn[];
  }

  let { columns = [] }: KanbanBoardProps = $props();

  let boardColumns = $state<KanbanColumn[]>([]);
  let dragState = $state<{ sourceColumnId: string; sourceIndex: number } | null>(null);

  const cloneColumns = (value: KanbanColumn[]) =>
    value.map((column) => ({
      ...column,
      items: [...(column.items ?? [])]
    }));

  const getColumnIndex = (columnId: string) => boardColumns.findIndex((column) => column.id === columnId);

  const onDragStart = (columnId: string, sourceIndex: number) => {
    dragState = { sourceColumnId: columnId, sourceIndex };
  };

  const onDrop = (targetColumnId: string) => {
    if (!dragState) {
      return;
    }

    const sourceColumnIndex = getColumnIndex(dragState.sourceColumnId);
    const targetColumnIndex = getColumnIndex(targetColumnId);

    if (sourceColumnIndex < 0 || targetColumnIndex < 0) {
      dragState = null;
      return;
    }

    const updated = cloneColumns(boardColumns);
    const sourceItems = updated[sourceColumnIndex].items;
    const [movedItem] = sourceItems.splice(dragState.sourceIndex, 1);

    if (!movedItem) {
      dragState = null;
      return;
    }

    updated[targetColumnIndex].items = [...updated[targetColumnIndex].items, movedItem];
    boardColumns = updated;
    dragState = null;
  };

  $effect(() => {
    boardColumns = cloneColumns(columns);
  });
</script>

<div class="overflow-x-auto pb-2">
  <div class="flex min-w-max gap-4 md:grid md:min-w-0 md:grid-cols-3">
    {#each boardColumns as column (column.id)}
      <section
        class="flex w-[18rem] shrink-0 max-h-[32rem] min-h-[24rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900 md:w-auto md:shrink"
        ondragover={(event) => event.preventDefault()}
        ondrop={() => onDrop(column.id)}
      >
        <header class="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-200">{column.title}</h3>
        </header>

        <div class="space-y-3 overflow-y-auto p-3">
          {#if column.items.length === 0}
            <p class="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Drop items here
            </p>
          {/if}

          {#each column.items as item, index (`${column.id}-${item.id ?? index}`)}
            <article
              class="cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800"
              draggable="true"
              ondragstart={() => onDragStart(column.id, index)}
            >
              <h4 class="text-sm font-medium text-slate-800 dark:text-slate-100">{item.title}</h4>

              {#if item.progress !== undefined}
                <div class="mt-3">
                  <div class="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Progress</span>
                    <span>{item.progress}%</span>
                  </div>
                  <div class="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      class="h-full rounded-full bg-blue-500 transition-all"
                      style={`width: ${Math.max(0, Math.min(100, item.progress))}%;`}
                    ></div>
                  </div>
                </div>
              {/if}

              {#if item.badges && item.badges.length > 0}
                <div class="mt-3 flex flex-wrap gap-1.5">
                  {#each item.badges as badge}
                    <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      {badge}
                    </span>
                  {/each}
                </div>
              {/if}
            </article>
          {/each}
        </div>
      </section>
    {/each}
  </div>
</div>
