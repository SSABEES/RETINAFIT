<script>
  /** @type {{ title?: string, description?: string }} */
  let { title = '', description = '' } = $props()
</script>

<main class="app-frame-page flex flex-col items-center justify-center px-5 py-8 text-center">
  {#if title}
    <h1 class="m-0 text-3xl font-bold text-zinc-950">{title}</h1>
  {/if}
  {#if description}
    <p class="mt-2 max-w-2xl text-base text-zinc-600">{description}</p>
  {/if}
  <slot />
</main>
