<script lang="ts">
  import { Skeleton } from '$components/ui';
</script>

<div class="space-y-6">
  <div class="space-y-2">
    <Skeleton width="180px" height="32px" variant="rectangular" />
    <Skeleton width="320px" height="18px" variant="text" />
  </div>

  <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <Skeleton variant="rectangular" height="240px" />
    <Skeleton variant="rectangular" height="240px" />
  </div>

  <Skeleton variant="rectangular" height="420px" />
</div>
