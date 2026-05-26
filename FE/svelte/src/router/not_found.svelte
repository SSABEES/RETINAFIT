<script>
  import { navigate } from '@maks11060/svelte5-router'
  import { Ban } from 'lucide-svelte'
  import { PATH } from '@/config/path'

  // 잘못된 URL 진입 시 visit_select 로 이동시킨다.
  function on_click_back_to_visit_select() {
    navigate(PATH.visitSelect)
  }
</script>

<main
  class="app-frame-page grid min-h-screen place-items-center bg-[var(--retina-bg-1)] text-[var(--retina-text)] px-[clamp(16px,4svh,40px)] py-[clamp(16px,4svh,40px)]"
>
  <section
    class="flex w-full max-w-[520px] flex-col items-center gap-[clamp(16px,3.5svh,32px)] rounded-[24px] border border-[var(--retina-text-200)] bg-white px-[clamp(20px,5svh,48px)] py-[clamp(28px,6svh,56px)] text-center shadow-[0_10px_30px_-12px_rgba(0,0,0,0.10)]"
    aria-label="페이지를 찾을 수 없습니다"
  >
    <span
      class="grid place-items-center rounded-full bg-[var(--retina-primary-50)] text-[var(--retina-primary-400)] h-[clamp(72px,14svh,120px)] w-[clamp(72px,14svh,120px)]"
      aria-hidden="true"
    >
      <Ban size={48} strokeWidth={2.2} />
    </span>

    <div class="flex flex-col items-center gap-[clamp(4px,1svh,8px)]">
      <p
        class="m-0 font-extrabold tracking-[0.2em] text-[var(--retina-primary-500)] text-[clamp(11px,1.8svh,14px)]"
      >
        404 NOT FOUND
      </p>
      <h1
        class="m-0 font-extrabold leading-tight text-[var(--retina-text-800)] text-[clamp(20px,4.5svh,34px)]"
      >
        페이지를 찾을 수 없어요
      </h1>
      <p
        class="m-0 font-medium leading-relaxed text-[var(--retina-text-500)] text-[clamp(12px,1.9svh,16px)]"
      >
        주소가 잘못 입력되었거나 페이지가 이동·삭제되었을 수 있습니다.<br />
        아래 버튼으로 처음 화면으로 돌아가 주세요.
      </p>
    </div>

    <button
      type="button"
      class="inline-flex w-full max-w-[280px] cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[var(--retina-primary-300)] font-extrabold text-white shadow-sm transition hover:bg-[var(--retina-primary-400)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retina-primary-400)]/30 h-[clamp(44px,8svh,60px)] text-[clamp(14px,2.6svh,18px)]"
      onclick={on_click_back_to_visit_select}
    >
      돌아가기
    </button>
  </section>
</main>
