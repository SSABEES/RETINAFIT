<script>
  /** @type {{ title?: string, description?: string }} */
  let { title = '', description = '' } = $props()
</script>

<main class="mx-auto w-full max-w-5xl px-5 py-8 text-left">
  {#if title}
    <h1 class="m-0 text-3xl font-bold text-zinc-950">{title}</h1>
  {/if}
  {#if description}
    <p class="mt-2 text-base text-zinc-600">{description}</p>
  {/if}
</main>
