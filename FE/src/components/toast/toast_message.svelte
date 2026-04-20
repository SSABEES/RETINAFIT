<script>
  /** @type {{
   *   message?: string,
   *   type?: 'success' | 'error' | 'info',
   * }}
   */
  let { message = '', type = 'info' } = $props()

  const tone = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-violet-200 bg-violet-50 text-violet-800',
  }
</script>

{#if message}
  <div
    class="rounded-lg border px-4 py-3 text-left text-sm font-semibold shadow-sm {tone[type]}"
    role="status"
  >
    {message}
  </div>
{/if}
