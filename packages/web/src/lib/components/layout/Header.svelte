<script lang="ts">
  import { page } from '$app/state';
  import { notificationsStore } from '$stores/notificationsStore';
  import { themeStore } from '$stores/themeStore';
  import { Bell, Menu, Moon, Search, Sun } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { appShellStore } from './layoutStore';

  const activeNotifications = notificationsStore.active;
  const resolvedTheme = themeStore.resolvedTheme;

  const breadcrumbs = $derived.by(() => {
    const segments = page.url.pathname.split('/').filter(Boolean);

    if (segments.length === 0) {
      return [{ href: '/', label: 'Home' }];
    }

    return segments.map((segment, index) => {
      const href = `/${segments.slice(0, index + 1).join('/')}`;
      const normalized = segment
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());

      return { href, label: normalized };
    });
  });

  function toggleTheme() {
    const nextTheme = get(resolvedTheme) === 'dark' ? 'light' : 'dark';
    themeStore.setTheme(nextTheme);
  }

  onMount(() => {
    themeStore.init();
  });
</script>

<header
  class="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/85 backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/80"
>
  <div class="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
    <div class="flex min-w-0 items-center gap-3">
      <button
        type="button"
        class="rounded-md border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 md:hidden"
        aria-label="Open menu"
        onclick={appShellStore.openSidebarMobile}
      >
        <Menu class="h-4 w-4" />
      </button>

      <nav class="truncate" aria-label="Breadcrumb">
        <ol class="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          {#each breadcrumbs as crumb, index}
            <li class="flex min-w-0 items-center gap-2">
              {#if index > 0}
                <span>/</span>
              {/if}
              <a
                href={crumb.href}
                class="truncate font-medium text-zinc-700 hover:text-violet-600 dark:text-zinc-200 dark:hover:text-violet-400"
              >
                {crumb.label}
              </a>
            </li>
          {/each}
        </ol>
      </nav>
    </div>

    <div
      class="hidden w-full max-w-md items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 lg:flex"
    >
      <Search class="h-4 w-4" />
      <input
        type="text"
        value="Search plans, tasks, agents..."
        readonly
        class="w-full bg-transparent text-sm text-zinc-500 outline-none dark:text-zinc-400"
        aria-label="Global search"
      />
      <span class="rounded border border-zinc-300 px-1.5 py-0.5 text-xs dark:border-zinc-600">⌘K</span>
    </div>

    <div class="flex items-center gap-2">
      <button
        type="button"
        class="rounded-md border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        aria-label="Toggle theme"
        onclick={toggleTheme}
      >
        {#if $resolvedTheme === 'dark'}
          <Sun class="h-4 w-4" />
        {:else}
          <Moon class="h-4 w-4" />
        {/if}
      </button>

      <button
        type="button"
        class="relative rounded-md border border-zinc-200 p-2 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        aria-label="Notifications"
      >
        <Bell class="h-4 w-4" />
        {#if $activeNotifications.length > 0}
          <span
            class="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-semibold text-white"
          >
            {$activeNotifications.length}
          </span>
        {/if}
      </button>

      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-xs font-semibold text-white"
        aria-label="User profile"
      >
        CV
      </button>
    </div>
  </div>
</header>
