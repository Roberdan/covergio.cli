import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import type { Theme } from '$types';

const theme = writable<Theme>(browser ? (localStorage.getItem('theme') as Theme) || 'system' : 'system');

const resolvedTheme = derived(theme, $theme => {
  if ($theme === 'system') {
    return browser && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return $theme;
});

function setTheme(newTheme: Theme) {
  theme.set(newTheme);
  if (browser) {
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  }
}

function applyTheme(t: Theme) {
  if (!browser) return;
  const resolved = t === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : t;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

function init() {
  if (!browser) return;
  const stored = localStorage.getItem('theme') as Theme || 'system';
  theme.set(stored);
  applyTheme(stored);
  // Watch for OS theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const current = localStorage.getItem('theme') as Theme;
    if (current === 'system') applyTheme('system');
  });
}

export const themeStore = { subscribe: theme.subscribe, theme, resolvedTheme, setTheme, init };
