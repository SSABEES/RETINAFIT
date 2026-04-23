<script>
  import { RotateCcw } from 'lucide-svelte'
  import {
    get_session,
    get_captures_ordered,
    reset as reset_session,
  } from '@/lib/stores/capture_session.svelte.js'

  /** @type {{
   *   onrestart?: (() => void) | undefined,
   * }}
   */
  let { onrestart = undefined } = $props()

  const g_session = $derived(get_session())
  const g_captures_arr = $derived(get_captures_ordered())

  // "처음부터" 버튼: 세션 초기화 + 상위에 알림 (모달 재호출 등).
  function on_click_restart() {
    reset_session()
    onrestart?.()
  }
</script>

<div class="flex flex-col gap-4">
  <div>
    <h2 class="m-0 text-xl font-extrabold text-zinc-950">촬영 완료</h2>
    <p class="m-0 mt-1 text-sm font-semibold text-slate-500">
      촬영된 {g_captures_arr.filter((c) => c !== null).length}장을 확인하세요
    </p>
  </div>

  <div class="grid grid-cols-3 gap-3">
    {#each g_captures_arr as capture, i (g_session.steps_arr[i]?.step_id ?? i)}
      {@const step = g_session.steps_arr[i]}
      <article class="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div class="relative aspect-[3/4] w-full bg-zinc-900">
          {#if capture}
            <img
              class="h-full w-full object-cover"
              src={capture.object_url}
              alt={step?.label ?? '캡쳐'}
            />
          {:else}
            <div class="grid h-full w-full place-items-center text-xs font-semibold text-zinc-500">
              촬영 안 됨
            </div>
          {/if}
        </div>
        <div class="px-3 py-2 text-sm font-bold text-zinc-900">{step?.label ?? ''}</div>
      </article>
    {/each}
  </div>

  <div class="mt-2 grid grid-cols-2 gap-3">
    <button
      class="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white text-base font-extrabold text-zinc-900 transition hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
      type="button"
      onclick={on_click_restart}
    >
      <RotateCcw size={16} strokeWidth={2.5} aria-hidden="true" />
      <span>처음부터</span>
    </button>
    <button
      class="inline-flex min-h-12 cursor-not-allowed items-center justify-center gap-2 rounded-lg border-0 bg-slate-300 text-base font-extrabold text-slate-600"
      type="button"
      disabled
      title="다음 단계에서 구현"
    >
      <span>다음: 측정</span>
    </button>
  </div>
</div>
