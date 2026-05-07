<script>
  /**
   * 얼굴 분석 플로우의 4단계 진행 상태를 헤더 바로 밑에 표시하는 step bar.
   * 얼굴 촬영/얼굴 분석 결과는 "얼굴 분석" 한 단계로 통합. 최종 리포트는 step bar 에서 제외.
   * current_step > 4 이면 모든 단계가 done 으로 표시 (예: 결과 페이지).
   *
   * @type {{ current_step: 1 | 2 | 3 | 4 | 5 }}
   */
  let { current_step = 1 } = $props()

  const STEP_ARR = [
    { num: 1, label: '얼굴 분석' },
    { num: 2, label: '생활 패턴 분석' },
    { num: 3, label: 'AR 피팅' },
    { num: 4, label: '실제 안경 분석' },
  ]
</script>

<!--
  normal flow 로 헤더(fixed top, 52px) 바로 밑에 자연스럽게 자리잡는다.
  .app-bg-edge-extend 가 negative margin 으로 .app-frame 좌우 빈 공간까지 배경 확장.
  fixed 를 안 쓰는 이유: app.css 의 unlayered .app-frame-page padding-top 이 Tailwind utility 보다
  우선순위가 높아 pt-[112px] 가 먹히지 않았다 → flex-col 의 in-flow 자식으로 두면 자연 해결.
-->
<footer
  class="app-bg-edge-extend shrink-0 border-b border-slate-200 bg-white px-6 py-2"
  aria-label="얼굴 분석 진행 단계"
>
  <div
    class="mx-auto flex w-full max-w-[860px] items-center justify-between gap-3"
    role="list"
  >
    {#each STEP_ARR as step_obj, step_index (step_obj.num)}
      {@const local_is_done = step_obj.num < current_step}
      {@const local_is_active = step_obj.num === current_step}
      <div class="flex shrink-0 items-center gap-3" role="listitem">
        <span
          class={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-[16px] font-extrabold transition-colors ${
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
          class={`text-[15px] font-extrabold leading-tight ${
            local_is_active
              ? 'text-[var(--retina-primary-400)]'
              : local_is_done
                ? 'text-slate-700'
                : 'text-slate-400'
          }`}
        >
          {step_obj.label}
        </span>
      </div>
      {#if step_index < STEP_ARR.length - 1}
        <span
          class={`h-px flex-1 ${local_is_done ? 'bg-[var(--retina-primary-300)]' : 'bg-slate-200'}`}
          aria-hidden="true"
        ></span>
      {/if}
    {/each}
  </div>
</footer>
