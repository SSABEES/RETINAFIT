<script>
  /** @type {{ message?: string }} */
  let { message = '' } = $props()
</script>

{#if message}
  <p class="m-0 text-left text-sm font-medium text-red-600" role="alert">{message}</p>
{/if}
