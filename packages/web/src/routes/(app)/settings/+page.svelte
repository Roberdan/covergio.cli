<script lang="ts">
  import { PageHeader } from '$components/layout';
  import Card from '$components/ui/Card.svelte';
  import { themeStore } from '$stores/themeStore';
  import type { Theme } from '$types';

  declare const __BUILD_TIME__: string;

  const themes: Theme[] = ['light', 'dark', 'system'];
  const theme = themeStore.theme;

  let refreshInterval = $state(30);

  const setTheme = (nextTheme: Theme) => {
    themeStore.setTheme(nextTheme);
  };

  const buildTime = $derived.by(() => {
    const parsed = new Date(__BUILD_TIME__);
    return Number.isNaN(parsed.getTime()) ? __BUILD_TIME__ : parsed.toLocaleString();
  });
</script>

<section class="space-y-6">
  <PageHeader title="Settings" />

  <Card variant="bordered">
    <div class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Appearance</h2>
        <p class="text-sm text-zinc-600 dark:text-zinc-400">Choose your theme preference.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        {#each themes as option}
          <button
            type="button"
            class={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
              $theme === option
                ? 'bg-violet-600 text-white'
                : 'border border-zinc-300 bg-white text-zinc-700 hover:border-violet-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'
            }`}
            onclick={() => setTheme(option)}
          >
            {option}
          </button>
        {/each}
      </div>
    </div>
  </Card>

  <Card variant="bordered">
    <div class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Data</h2>
        <p class="text-sm text-zinc-600 dark:text-zinc-400">Set dashboard refresh interval.</p>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-300">
          <span>Refresh interval</span>
          <span>{refreshInterval}s</span>
        </div>
        <input
          type="range"
          min="5"
          max="60"
          step="5"
          bind:value={refreshInterval}
          class="w-full accent-violet-600"
        />
      </div>
    </div>
  </Card>

  <Card variant="bordered">
    <div class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">About</h2>
      </div>

      <dl class="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
        <div class="flex items-center justify-between">
          <dt>Version</dt>
          <dd class="font-medium text-zinc-900 dark:text-zinc-100">1.0.0</dd>
        </div>
        <div class="flex items-center justify-between">
          <dt>Build time</dt>
          <dd class="font-medium text-zinc-900 dark:text-zinc-100">{buildTime}</dd>
        </div>
      </dl>

      <div class="flex flex-wrap gap-3 text-sm">
        <a
          href="https://github.com/roberdan/covergio.cli"
          target="_blank"
          rel="noreferrer"
          class="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
        >
          GitHub Repository
        </a>
      </div>
    </div>
  </Card>
</section>
