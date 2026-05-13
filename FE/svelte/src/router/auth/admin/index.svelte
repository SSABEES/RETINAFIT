<script>
  import { navigate } from '@maks11060/svelte5-router'
  import { PATH } from '@/config/path'
  import AdminLayout from '@/router/auth/admin/admin_layout.svelte'

  // 얼굴형 기준 설정은 일단 카드에서 제외. 페이지/라우트는 보존되어 있음.
  const g_admin_card_arr = [
    { title: '렌즈조건 설정', href: PATH.adminLens },
    { title: '안경 정보', href: PATH.adminGlass },
  ]

  // 관리자 카드 클릭 시 해당 설정 화면으로 이동한다.
  function on_click_move_admin_page(href) {
    navigate(href)
  }
</script>

<AdminLayout active_key="index">
  <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
    {#each g_admin_card_arr as admin_card_obj (admin_card_obj.href)}
      <button
        class="min-h-[220px] cursor-pointer rounded-[14px] border border-[var(--retina-text-200)] bg-white p-8 text-left shadow-[0_4px_10px_rgba(19,25,40,0.04)] transition hover:border-[var(--retina-primary-400)] hover:bg-[var(--retina-primary-50)] hover:shadow-[0_6px_18px_rgba(234,106,15,0.14)]"
        type="button"
        onclick={() => on_click_move_admin_page(admin_card_obj.href)}
      >
        <span class="text-2xl font-extrabold text-[var(--retina-text-800)]"
          >{admin_card_obj.title}</span
        >
      </button>
    {/each}
  </section>
</AdminLayout>
