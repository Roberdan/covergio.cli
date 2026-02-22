<script lang="ts">
  import '../app.css';
  import { themeStore } from '$stores/themeStore';
  import { NotificationToast } from '$components/layout';
  import { onMount } from 'svelte';

  let { children } = $props();

  onMount(() => themeStore.init());
</script>

<div class="min-h-screen">
  {@render children()}
</div>
<NotificationToast />
