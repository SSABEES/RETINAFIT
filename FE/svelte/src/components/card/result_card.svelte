<script>
  /** @type {{ title?: string, value?: string, description?: string }} */
  let { title = 'Result', value = '', description = '' } = $props()
</script>

<article class="rounded-lg border border-zinc-200 bg-white p-5 text-left shadow-sm">
  <h3 class="m-0 text-sm font-semibold text-zinc-500">{title}</h3>
  {#if value}
    <p class="mt-2 text-2xl font-bold text-zinc-950">{value}</p>
  {/if}
  {#if description}
    <p class="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
  {/if}
</article>
