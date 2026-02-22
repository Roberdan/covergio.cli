<script lang="ts">
  import type { Snippet } from 'svelte';
  import Header from './Header.svelte';
  import NotificationToast from './NotificationToast.svelte';
  import Sidebar from './Sidebar.svelte';

  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
  <div class="flex min-h-screen">
    <Sidebar />

    <div class="flex min-w-0 flex-1 flex-col">
      <Header />

      <main class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {@render children?.()}
      </main>
    </div>
  </div>

  <NotificationToast />
</div>
