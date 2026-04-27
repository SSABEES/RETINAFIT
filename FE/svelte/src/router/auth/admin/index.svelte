<script>
  import { PATH } from '@/config/path'
  import AdminLayout from '@/router/auth/admin/admin_layout.svelte'

  const g_admin_card_arr = [
    { title: '얼굴형 기준 설정', href: PATH.adminFace },
    { title: '렌즈조건 설정', href: PATH.adminLens },
    { title: '안경 정보', href: PATH.adminGlass },
  ]

  // 관리자 카드 클릭 시 해당 설정 화면으로 이동한다.
  function on_click_move_admin_page(href) {
    window.location.href = href
  }
</script>

<AdminLayout active_key="index">
  <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {#each g_admin_card_arr as admin_card_obj (admin_card_obj.href)}
      <button
        class="min-h-[220px] cursor-pointer rounded-2xl border border-slate-200 bg-white p-8 text-left shadow-sm shadow-slate-200/50 transition hover:border-[#D8C6E0] hover:bg-[#FCFAFD]"
        type="button"
        onclick={() => on_click_move_admin_page(admin_card_obj.href)}
      >
        <span class="text-2xl font-extrabold text-zinc-950">{admin_card_obj.title}</span>
      </button>
    {/each}
  </section>
</AdminLayout>
