<script lang="ts">
  import { page } from '$app/state';
  import {
    BarChart3,
    Bot,
    ChevronsLeft,
    ChevronsRight,
    FolderKanban,
    LayoutDashboard,
    Settings,
    X
  } from 'lucide-svelte';
  import type { Component } from 'svelte';
  import { appShellStore, sidebarCollapsed, sidebarMobileOpen } from './layoutStore';

  interface NavItem {
    label: string;
    href: string;
    icon: Component<{ class?: string }>;
    badge?: number;
  }

  interface NavGroup {
    title: string;
    items: NavItem[];
  }

  const navGroups: NavGroup[] = [
    {
      title: 'Main',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { label: 'Plans', href: '/plans', icon: FolderKanban, badge: 3 },
        { label: 'Agents', href: '/agents', icon: Bot }
      ]
    },
    {
      title: 'Workspace',
      items: [
        { label: 'Metrics', href: '/metrics', icon: BarChart3 },
        { label: 'Settings', href: '/settings', icon: Settings }
      ]
    }
  ];

  const currentPath = $derived(page.url.pathname);

  function isActive(href: string) {
    if (href === '/dashboard') {
      return currentPath === href;
    }

    return currentPath === href || currentPath.startsWith(`${href}/`);
  }
</script>

<aside
  class="hidden h-screen shrink-0 border-r border-zinc-200 bg-white transition-[width] duration-200
    dark:border-zinc-800 dark:bg-zinc-900 md:flex"
  class:w-16={$sidebarCollapsed}
  class:w-64={!$sidebarCollapsed}
>
  <div class="flex h-full w-full flex-col">
    <div class="flex h-16 items-center border-b border-zinc-200 px-4 dark:border-zinc-800">
      <div class="flex items-center gap-3">
        <div
          class="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500"
        ></div>
        {#if !$sidebarCollapsed}
          <div>
            <p class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Convergio</p>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">Control Center</p>
          </div>
        {/if}
      </div>
    </div>

    <nav class="flex-1 space-y-6 overflow-y-auto px-2 py-4">
      {#each navGroups as group}
        <div>
          {#if !$sidebarCollapsed}
            <p class="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {group.title}
            </p>
          {/if}

          <div class="space-y-1">
            {#each group.items as item}
              <a
                href={item.href}
                class={`group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-violet-500 text-white'
                    : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
                class:justify-center={$sidebarCollapsed}
                title={$sidebarCollapsed ? item.label : undefined}
              >
                <svelte:component this={item.icon} class="h-5 w-5 shrink-0" />

                {#if !$sidebarCollapsed}
                  <span class="ml-3 flex-1">{item.label}</span>
                  {#if item.badge !== undefined}
                    <span
                      class="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      {item.badge}
                    </span>
                  {/if}
                {/if}
              </a>
            {/each}
          </div>
        </div>
      {/each}
    </nav>

    <div class="border-t border-zinc-200 p-2 dark:border-zinc-800">
      <button
        type="button"
        class="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        class:justify-center={$sidebarCollapsed}
        onclick={appShellStore.toggleSidebarCollapsed}
      >
        {#if $sidebarCollapsed}
          <ChevronsRight class="h-5 w-5" />
          <span class="sr-only">Expand sidebar</span>
        {:else}
          <ChevronsLeft class="h-5 w-5" />
          <span class="ml-3">Collapse</span>
        {/if}
      </button>
    </div>
  </div>
</aside>

{#if $sidebarMobileOpen}
  <button
    type="button"
    class="fixed inset-0 z-40 bg-black/50 md:hidden"
    aria-label="Close menu"
    onclick={appShellStore.closeSidebarMobile}
  ></button>
{/if}

<aside
  class="fixed inset-y-0 left-0 z-50 w-64 border-r border-zinc-200 bg-white transition-transform duration-200 dark:border-zinc-800 dark:bg-zinc-900 md:hidden"
  class:-translate-x-full={!$sidebarMobileOpen}
  class:translate-x-0={$sidebarMobileOpen}
>
  <div class="flex h-full flex-col">
    <div class="flex h-16 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
      <div class="flex items-center gap-3">
        <div
          class="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500"
        ></div>
        <p class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Convergio</p>
      </div>

      <button
        type="button"
        class="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        aria-label="Close menu"
        onclick={appShellStore.closeSidebarMobile}
      >
        <X class="h-4 w-4" />
      </button>
    </div>

    <nav class="flex-1 space-y-6 overflow-y-auto px-2 py-4">
      {#each navGroups as group}
        <div>
          <p class="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {group.title}
          </p>

          <div class="space-y-1">
            {#each group.items as item}
              <a
                href={item.href}
                class={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-violet-500 text-white'
                    : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
                onclick={appShellStore.closeSidebarMobile}
              >
                <svelte:component this={item.icon} class="h-5 w-5 shrink-0" />
                <span class="ml-3 flex-1">{item.label}</span>
                {#if item.badge !== undefined}
                  <span
                    class="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {item.badge}
                  </span>
                {/if}
              </a>
            {/each}
          </div>
        </div>
      {/each}
    </nav>
  </div>
</aside>
