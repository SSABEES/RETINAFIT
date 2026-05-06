<script>
  import LoadingSpinner from './loading_spinner.svelte'

  /** @type {{ open?: boolean, label?: string, size?: number }} */
  let { open = false, label = '저장 중...', size = 64 } = $props()
</script>

{#if open}
  <!--
    PATCH 등 비동기 작업 중에 화면 전체를 반투명 흰색으로 가려 중복 클릭/네비게이션을 방지하고
    진행 중임을 시각적으로 알린다. LogoSymbol 기반 스피너 + 라벨을 카드 형태로 중앙 배치.
  -->
  <div
    class="fixed inset-0 z-50 grid place-items-center bg-white/70 backdrop-blur-sm"
    role="status"
    aria-live="polite"
  >
    <div
      class="flex flex-col items-center gap-4 rounded-2xl bg-white px-8 py-6 shadow-[0_12px_32px_rgba(15,23,42,0.18)]"
    >
      <LoadingSpinner show_label={false} {size} />
      {#if label}
        <p class="m-0 text-[14px] font-extrabold text-[#EA6A0F]">{label}</p>
      {/if}
    </div>
  </div>
{/if}
