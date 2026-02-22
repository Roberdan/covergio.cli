<script lang="ts">
  import { page } from '$app/stores';
</script>

<div class="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950">
  <div class="text-center space-y-4">
    <h1 class="text-6xl font-bold text-primary-600">{$page.status}</h1>
    <p class="text-xl text-surface-600 dark:text-surface-400">{$page.error?.message || 'Page not found'}</p>
    <a href="/dashboard" class="inline-block mt-4 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
      Back to Dashboard
    </a>
  </div>
</div>
