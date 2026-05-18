<script>
  /**
   * 얼굴 분석 플로우의 3단계 진행 상태를 헤더 바로 밑에 표시하는 step bar.
   * 얼굴 촬영/얼굴 분석 결과는 "얼굴 분석" 한 단계로 통합. 최종 리포트는 step bar 에서 제외.
   * current_step > 3 이면 모든 단계가 done 으로 표시 (예: 결과 페이지).
   * 실제 안경 분석 단계는 일단 비활성화 — 다시 살릴 때 STEP_ARR 마지막 항목 주석을 풀면 된다.
   *
   * @type {{ current_step: 1 | 2 | 3 | 4 }}
   */
  let { current_step = 1 } = $props()

  const STEP_ARR = [
    { num: 1, label: '얼굴 분석' },
    { num: 2, label: '생활 패턴 분석' },
    { num: 3, label: '안경 피팅' },
    // { num: 4, label: '실제 안경 분석' },
  ]
</script>

<!--
  헤더 바로 밑 in-flow step bar. 모바일에선 라벨 숨기고 번호 원만 표시, sm 이상에서 라벨 노출.
-->
<footer
  class="shrink-0 border-b border-slate-200 bg-white px-[clamp(12px,3vw,24px)] py-2"
  aria-label="얼굴 분석 진행 단계"
>
  <!--
    max-w 를 xl/2xl 브레이크포인트(560→760→960px)로 점프시키면 1280·1536px 경계에서 콘텐츠
    폭이 확 변한다 → clamp(vw) 로 560~960px 사이를 창 너비에 비례해 연속 변화.
  -->
  <div
    class="mx-auto flex w-full max-w-[clamp(560px,55vw,960px)] items-center justify-between gap-2 sm:gap-3"
    role="list"
  >
    {#each STEP_ARR as step_obj, step_index (step_obj.num)}
      {@const local_is_done = step_obj.num < current_step}
      {@const local_is_active = step_obj.num === current_step}
      <div class="flex shrink-0 items-center gap-2 sm:gap-3" role="listitem">
        <span
          class={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[14px] font-extrabold transition-colors sm:h-10 sm:w-10 sm:text-[16px] ${
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
          class={`hidden text-[13px] font-extrabold leading-tight sm:inline sm:text-[15px] ${
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
