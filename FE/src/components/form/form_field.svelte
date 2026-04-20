<script>
  /** @type {{ label?: string, helper?: string }} */
  let { label = 'Field', helper = '' } = $props()
</script>

<div class="grid gap-2 text-left">
  <span class="text-sm font-semibold text-zinc-800">{label}</span>
  {#if helper}
    <p class="m-0 text-sm text-zinc-500">{helper}</p>
  {/if}
</div>
