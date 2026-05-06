<script>
  /**
   * 얼굴 분석 플로우의 5단계 진행 상태를 화면 하단에 표시하는 step bar.
   * 각 페이지는 자기 단계 번호만 prop 으로 넘기면 자동으로 done/active/pending 표시가 갈린다.
   *
   * @type {{ current_step: 1 | 2 | 3 | 4 | 5 }}
   */
  let { current_step = 1 } = $props()

  const STEP_ARR = [
    { num: 1, label: '얼굴 촬영' },
    { num: 2, label: '얼굴 분석' },
    { num: 3, label: '생활 패턴 분석' },
    { num: 4, label: 'AR 피팅' },
    { num: 5, label: '최종 리포트' },
  ]
</script>

<!--
  position: fixed + .app-edge-extend → .app-frame 좌우 빈 공간까지 viewport 끝까지 확장.
-->
<footer
  class="app-edge-extend fixed bottom-0 z-30 border-t border-slate-200 bg-white px-6 py-3.5"
  aria-label="얼굴 분석 진행 단계"
>
  <ol class="mx-auto flex w-full max-w-[860px] items-center gap-2">
    {#each STEP_ARR as step_obj, step_index (step_obj.num)}
      {@const local_is_done = step_obj.num < current_step}
      {@const local_is_active = step_obj.num === current_step}
      <li class="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          class={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-extrabold transition-colors ${
            local_is_done
              ? 'bg-[var(--retina-primary-300)] text-white'
              : local_is_active
                ? 'border-2 border-[var(--retina-primary-300)] bg-white text-[var(--retina-primary-400)]'
                : 'bg-slate-100 text-slate-400'
          }`}
          aria-current={local_is_active ? 'step' : undefined}
        >
          {step_obj.num}
        </span>
        <span
          class={`truncate text-[12px] font-extrabold leading-tight ${
            local_is_active
              ? 'text-[var(--retina-primary-400)]'
              : local_is_done
                ? 'text-slate-700'
                : 'text-slate-400'
          }`}
        >
          {step_obj.label}
        </span>
        {#if step_index < STEP_ARR.length - 1}
          <span
            class={`h-px flex-1 ${local_is_done ? 'bg-[var(--retina-primary-300)]' : 'bg-slate-200'}`}
            aria-hidden="true"
          ></span>
        {/if}
      </li>
    {/each}
  </ol>
</footer>
