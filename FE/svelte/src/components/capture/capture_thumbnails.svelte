<script>
  import { get_session } from '@/lib/stores/capture_session.svelte.js'

  const g_session = $derived(get_session())
</script>

<div
  class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40"
>
  <div class="text-sm font-extrabold text-zinc-950">촬영 기록</div>
  <div class="grid grid-cols-3 gap-2">
    {#each g_session.steps_arr as step, i (step.step_id)}
      {@const capture = g_session.captures_obj[step.step_id]}
      <div
        class="relative aspect-[3/4] overflow-hidden rounded-md border border-slate-200 bg-slate-50"
        aria-label="Step {i + 1} {capture ? '촬영 완료' : '미촬영'}"
      >
        {#if capture}
          <img src={capture.object_url} alt={step.label} class="h-full w-full object-cover" />
          <span
            class="absolute left-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-[var(--retinal-success-700)] text-[9px] font-extrabold text-white"
            aria-hidden="true"
          >
            ✓
          </span>
        {:else}
          <div
            class="grid h-full w-full place-items-center text-xs font-extrabold text-slate-400"
            aria-hidden="true"
          >
            {i + 1}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>
