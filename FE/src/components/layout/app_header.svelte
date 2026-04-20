<script>
  /** @type {{ title?: string }} */
  let { title = 'TTT' } = $props()
</script>

<header class="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 px-5 py-4 backdrop-blur">
  <div class="mx-auto flex max-w-5xl items-center justify-between">
    <h1 class="m-0 text-xl font-bold text-zinc-950">{title}</h1>
  </div>
</header>
