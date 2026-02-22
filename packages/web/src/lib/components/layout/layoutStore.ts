import { writable } from 'svelte/store';

const sidebarCollapsed = writable(false);
const sidebarMobileOpen = writable(false);

function setSidebarCollapsed(collapsed: boolean) {
  sidebarCollapsed.set(collapsed);
}

function toggleSidebarCollapsed() {
  sidebarCollapsed.update((collapsed) => !collapsed);
}

function openSidebarMobile() {
  sidebarMobileOpen.set(true);
}

function closeSidebarMobile() {
  sidebarMobileOpen.set(false);
}

function toggleSidebarMobile() {
  sidebarMobileOpen.update((open) => !open);
}

export const appShellStore = {
  sidebarCollapsed,
  sidebarMobileOpen,
  setSidebarCollapsed,
  toggleSidebarCollapsed,
  openSidebarMobile,
  closeSidebarMobile,
  toggleSidebarMobile
};

export { sidebarCollapsed, sidebarMobileOpen };
