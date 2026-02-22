<script lang="ts">
  import { AppShell } from '$components/layout';
  let { children } = $props();
</script>

<AppShell>
  {@render children()}
</AppShell>
