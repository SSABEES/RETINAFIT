<script>
  import { fade, fly } from 'svelte/transition'
  import { toast_obj_store } from '@/lib/stores/toast'
</script>

{#if $toast_obj_store}
  <div
    class="fixed bottom-8 left-1/2 z-[100] -translate-x-1/2"
    in:fly={{ y: 12, duration: 250 }}
    out:fade={{ duration: 200 }}
  >
    <div
      class={`flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl backdrop-blur-md ${
        $toast_obj_store.type === 'error'
          ? 'bg-red-600/95'
          : $toast_obj_store.type === 'success'
            ? 'bg-emerald-600/95'
            : 'bg-zinc-900/95'
      }`}
    >
      <span class="text-sm font-bold text-white">{$toast_obj_store.message}</span>
    </div>
  </div>
{/if}
