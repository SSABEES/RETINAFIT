<script>
  import { get_session } from '@/lib/stores/capture_session.svelte.js'

  const g_session = $derived(get_session())
</script>

<section class="flex flex-col gap-3">
  <div
    class="text-[11px] tracking-[0.22em] uppercase italic"
    style="font-family: var(--font-serif); color: var(--cp-graphite);"
  >
    Record
  </div>

  <div class="grid grid-cols-3 gap-2">
    {#each g_session.steps_arr as step, i (step.step_id)}
      {@const capture = g_session.captures_obj[step.step_id]}
      {@const num = String(i + 1).padStart(2, '0')}
      <figure
        class="relative aspect-[3/4] overflow-hidden border bg-white"
        style="border-color: var(--cp-rule);"
        aria-label="Step {i + 1} {capture ? '촬영 완료' : '미촬영'}"
      >
        {#if capture}
          <img
            src={capture.object_url}
            alt={step.label}
            class="h-full w-full object-cover"
          />
        {/if}

        <figcaption
          class="absolute left-1.5 top-1 text-[10px] leading-none tracking-wider"
          style="font-family: var(--font-mono); color: {capture ? '#ffffff' : 'var(--cp-graphite)'}; text-shadow: {capture ? '0 1px 2px rgba(0,0,0,0.6)' : 'none'};"
          aria-hidden="true"
        >
          {num}
        </figcaption>
      </figure>
    {/each}
  </div>
</section>
