<script>
  import { progress_label } from '@/lib/capture/step_config.js'

  /** @type {{
   *   current_index?: number,
   *   total?: number,
   * }}
   */
  let { current_index = 0, total = 6 } = $props()

  const g_label = $derived(progress_label(current_index, total))
</script>

<div class="flex flex-col items-center gap-2">
  <div class="flex items-center gap-2" aria-label="촬영 진행도">
    {#each Array(total) as _, i}
      {@const is_done = i < current_index}
      {@const is_current = i === current_index}
      <span
        class="h-2.5 w-2.5 rounded-full transition"
        style={
          is_done
            ? 'background: #4B0055;'
            : is_current
              ? 'background: white; box-shadow: 0 0 0 2px #4B0055;'
              : 'background: #d4d4d8;'
        }
        aria-hidden="true"
      ></span>
    {/each}
  </div>
  <span class="text-xs font-bold tabular-nums text-slate-600">{g_label}</span>
</div>
