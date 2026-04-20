<script>
  import LoadingSpinner from './loading_spinner.svelte'

  /** @type {{ label?: string }} */
  let { label = 'Loading' } = $props()
</script>

<div class="fixed inset-0 z-40 grid place-items-center bg-white/80 backdrop-blur-sm">
  <LoadingSpinner {label} />
</div>
