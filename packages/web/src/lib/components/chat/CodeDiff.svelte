<script lang="ts">
  interface CodeDiffProps {
    filename: string;
    additions?: string[];
    deletions?: string[];
    content?: string;
  }

  let { filename, additions = [], deletions = [], content }: CodeDiffProps = $props();
</script>

<div class="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
  <div class="flex items-center gap-2 bg-zinc-100 px-3 py-1.5 dark:bg-zinc-800">
    <span class="text-xs font-medium text-zinc-600 dark:text-zinc-300">{filename}</span>
    {#if additions.length > 0}
      <span class="text-xs text-emerald-600">+{additions.length}</span>
    {/if}
    {#if deletions.length > 0}
      <span class="text-xs text-red-500">-{deletions.length}</span>
    {/if}
  </div>

  <div class="overflow-x-auto bg-zinc-950 p-2 font-mono text-xs leading-5">
    {#each deletions as line}
      <div class="bg-red-950/30 text-red-400">
        <span class="mr-2 select-none text-red-600">-</span>{line}
      </div>
    {/each}
    {#each additions as line}
      <div class="bg-emerald-950/30 text-emerald-400">
        <span class="mr-2 select-none text-emerald-600">+</span>{line}
      </div>
    {/each}
    {#if content}
      <div class="text-zinc-400">{content}</div>
    {/if}
  </div>
</div>
