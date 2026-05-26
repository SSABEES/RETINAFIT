<script>
  /**
   * 분석 플로우 페이지 (report / lens_consult / result) 의 하단 액션바 공통 shell.
   * 외곽(좌우 viewport 확장, 흰 배경, 상단 divider, shrink-0) 만 표준화하고 내부
   * 콘텐츠는 호출자가 children snippet 으로 자유롭게 구성한다. 버튼 개수/비율/색이
   * 페이지마다 달라 prop 으로 정형화하면 분기가 늘어 가독성이 나빠지기 때문.
   *
   * 패딩만 페이지별 미세 차이가 있어 padding_class prop 으로 override 가능.
   *
   * @type {{
   *   children: import('svelte').Snippet,
   *   padding_class?: string,
   * }}
   */
  let {
    children,
    padding_class = 'px-[clamp(8px,2svh,16px)] py-[clamp(6px,1.5svh,14px)]',
  } = $props()
</script>

<div class={`app-bg-edge-extend shrink-0 border-t border-slate-200 bg-white ${padding_class}`}>
  {@render children?.()}
</div>
