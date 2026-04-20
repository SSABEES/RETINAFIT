<script>
  /** @type {{ label?: string }} */
  let { label = 'Loading' } = $props()
</script>

<div
  class="inline-flex items-center gap-3 text-sm font-semibold text-violet-700"
  role="status"
  aria-live="polite"
>
  <span class="size-5 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600"
  ></span>
  <span>{label}</span>
</div>
