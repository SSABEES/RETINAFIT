<script>
  import { get } from 'svelte/store'
  import { navigate } from '@maks11060/svelte5-router'
  import CaptureShell from '@/components/capture/capture_shell.svelte'
  import Header from '@/components/layout/header.svelte'
  import { PATH } from '@/config/path'
  import { clear_login_select_data } from '@/lib/stores/admin'
  import { clear_auto_login_obj } from '@/lib/stores/auto_login'
  import { selected_customer_obj } from '@/lib/stores/customer'

  // 비회원(cust_no=0)으로 진입한 경우 방문 유형 선택 화면으로, 회원이면 고객 조회 화면으로 돌아간다.
  function on_click_go_back() {
    const local_customer_obj = get(selected_customer_obj)
    const local_is_guest_visit = Number(local_customer_obj?.id) === 0

    navigate(local_is_guest_visit ? PATH.visitSelect : PATH.users)
  }

  // 헤더 로그아웃 → 토큰/자동로그인 스토어 비우고 로그인 화면으로 이동.
  function on_click_logout() {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('token_no')
    clear_login_select_data()
    clear_auto_login_obj()
    navigate(PATH.login)
  }
</script>

<main
  class="app-frame-page grid min-h-full grid-rows-[auto_1fr] overflow-hidden bg-[var(--retina-surface)] text-[var(--retina-text)]"
>
  <Header onback={on_click_go_back} onlogout={on_click_logout} />

  <CaptureShell />
</main>
