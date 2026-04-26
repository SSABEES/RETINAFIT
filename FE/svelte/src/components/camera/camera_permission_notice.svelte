<script>
  /** @type {{ message?: string }} */
  let { message = 'Camera permission is required.' } = $props()
</script>

<div
  class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-left text-sm font-medium leading-6 text-amber-900"
>
  {message}
</div>
