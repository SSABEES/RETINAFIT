<script>
  /** @type {{ label?: string }} */
  let { label = 'Camera preview' } = $props()
</script>

<section class="grid aspect-[3/4] w-full place-items-center overflow-hidden rounded-lg bg-zinc-950 text-center text-sm font-semibold text-white">
  {label}
</section>
