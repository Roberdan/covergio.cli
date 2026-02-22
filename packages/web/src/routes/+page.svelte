<script lang="ts">
  declare const __VERSION__: string;
</script>

<div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 via-violet-50 to-fuchsia-50 p-6 dark:from-zinc-950 dark:via-zinc-900 dark:to-violet-950">
  <div class="w-full max-w-xl rounded-2xl border border-violet-200 bg-white/90 p-8 text-center shadow-xl backdrop-blur dark:border-violet-800/50 dark:bg-zinc-900/80">
    <p class="bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 bg-clip-text text-4xl font-black tracking-[0.3em] text-transparent sm:text-5xl">
      CONVERGIO
    </p>
    <p class="mt-4 text-lg text-zinc-600 dark:text-zinc-300">AI Agent Orchestration Platform</p>

    <a
      href="/dashboard"
      class="mt-8 inline-flex items-center rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
    >
      Enter Dashboard →
    </a>

    <div class="mt-8 text-xs text-zinc-500 dark:text-zinc-400">
      <span class="rounded-full border border-zinc-300 px-3 py-1 dark:border-zinc-700">
        v{__VERSION__}
      </span>
    </div>
  </div>
</div>
