<script lang="ts">
  import { Skeleton } from '$components/ui';
</script>

<div class="space-y-6">
  <div class="space-y-2">
    <Skeleton width="220px" height="32px" variant="rectangular" />
    <Skeleton width="380px" height="18px" variant="text" />
  </div>

  <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
    <Skeleton variant="rectangular" height="120px" />
    <Skeleton variant="rectangular" height="120px" />
    <Skeleton variant="rectangular" height="120px" />
  </div>

  <Skeleton variant="rectangular" height="360px" />
</div>
