<script>
  import AdminSelector from './admin_selector.svelte'
  import DashboardSidebar from './dashboard_sidebar.svelte'

  /** @type {{ active_key?: string, title?: string, children?: import('svelte').Snippet, header_left?: import('svelte').Snippet, header_action?: import('svelte').Snippet }} */
  let { active_key = '', title = '', children, header_left, header_action } = $props()
</script>

<main
  class="grid h-full min-h-0 max-h-full w-full grid-cols-[240px_1fr] overflow-hidden bg-[#F7F8FA] text-[var(--retinal-text)]"
>
  <DashboardSidebar {active_key} />

  <section class="flex min-h-0 min-w-0 flex-col overflow-hidden">
    <header
      class="grid h-[92px] grid-cols-[1fr_auto_1fr] items-center border-b border-[var(--retinal-border)] bg-white px-8"
    >
      <div class="flex items-center justify-start gap-3">
        {@render header_left?.()}
      </div>

      <h1 class="m-0 text-2xl font-extrabold tracking-normal text-zinc-950">{title}</h1>

      <div class="flex items-center justify-end gap-3">
        <AdminSelector />
        {@render header_action?.()}
      </div>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto">
      {@render children?.()}
    </div>
  </section>
</main>
