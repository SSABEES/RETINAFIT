<script>
  /** @type {{ title?: string, description?: string, status?: string }} */
  let { title = 'Analysis', description = '', status = 'Ready' } = $props()
</script>

<article class="rounded-lg border border-zinc-200 bg-white p-5 text-left shadow-sm">
  <div class="flex items-start justify-between gap-4">
    <h3 class="m-0 text-lg font-bold text-zinc-950">{title}</h3>
    <span class="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700"
      >{status}</span
    >
  </div>
  {#if description}
    <p class="mt-3 text-sm leading-6 text-zinc-600">{description}</p>
  {/if}
</article>
