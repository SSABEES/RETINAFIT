<script>
  import { get } from 'svelte/store'
  import { navigate } from '@maks11060/svelte5-router'
  import CaptureShell from '@/components/capture/capture_shell.svelte'
  import Header from '@/components/layout/header.svelte'
  import AnalysisStepBar from '@/components/layout/analysis_step_bar.svelte'
  import { PATH } from '@/config/path'
  import { selected_customer_obj } from '@/lib/stores/customer'

  // 비회원(cust_no=0)으로 진입한 경우 방문 유형 선택 화면으로, 회원이면 고객 조회 화면으로 돌아간다.
  function on_click_go_back() {
    const local_customer_obj = get(selected_customer_obj)
    const local_is_guest_visit = Number(local_customer_obj?.id) === 0

    navigate(local_is_guest_visit ? PATH.visitSelect : PATH.users)
  }
</script>

<main
  class="app-frame-page grid min-h-full grid-rows-[auto_1fr_auto] overflow-hidden bg-[var(--retina-surface)] text-[var(--retina-text)]"
>
  <Header onback={on_click_go_back} />

  <CaptureShell />

  <AnalysisStepBar current_step={1} />
</main>
