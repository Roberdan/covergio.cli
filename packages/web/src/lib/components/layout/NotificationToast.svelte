<script lang="ts">
  import { notificationsStore } from '$stores/notificationsStore';
  import type { Notification } from '$types';
  import { X } from 'lucide-svelte';
  import { fly } from 'svelte/transition';

  const activeNotifications = notificationsStore.active;

  function borderClass(type: Notification['type']) {
    if (type === 'success') return 'border-l-emerald-500';
    if (type === 'error') return 'border-l-red-500';
    if (type === 'warning') return 'border-l-amber-500';
    return 'border-l-blue-500';
  }
</script>

<div class="pointer-events-none fixed right-4 top-4 z-[70] w-full max-w-sm" aria-live="polite">
  <div class="space-y-3">
    {#each $activeNotifications as notification (notification.id)}
      <article
        class={`pointer-events-auto rounded-lg border border-zinc-200 border-l-4 bg-white p-4 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 ${borderClass(notification.type)}`}
        in:fly={{ x: 80, duration: 180 }}
        out:fly={{ x: 200, duration: 220 }}
      >
        <div class="flex items-start gap-3">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{notification.title}</p>
            {#if notification.message}
              <p class="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{notification.message}</p>
            {/if}
          </div>

          <button
            type="button"
            class="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label="Dismiss notification"
            onclick={() => notificationsStore.dismiss(notification.id)}
          >
            <X class="h-4 w-4" />
          </button>
        </div>
      </article>
    {/each}
  </div>
</div>
