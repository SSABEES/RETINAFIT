<script>
  import { onMount } from 'svelte'
  import { navigate } from '@maks11060/svelte5-router'
  import { ArrowLeft, LogOut } from 'lucide-svelte'
  import CaptureShell from '@/components/capture/capture_shell.svelte'
  import CameraPermissionModal from '@/components/modal/camera_permission_modal.svelte'
  import { PATH } from '@/config/path'
  import {
    check_camera_permission_state,
    request_camera_permission,
    watch_camera_permission_change,
  } from '@/lib/capture/permission'
  import { clear_login_select_data } from '@/lib/stores/admin'
  import { clear_auto_login_obj } from '@/lib/stores/auto_login'

  let g_permission_state = $state(
    /** @type {'granted' | 'denied' | 'prompt' | 'unsupported'} */ ('prompt'),
  )
  let g_permission_modal_open = $state(false)

  // 헤더의 뒤로가기 — 고객 조회 화면으로 돌아간다.
  function on_click_go_back() {
    navigate(PATH.users)
  }

  // 헤더의 로그아웃 — 토큰/자동로그인/스토어를 비우고 로그인 화면으로 이동한다.
  function on_click_logout() {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('token_no')
    clear_login_select_data()
    clear_auto_login_obj()
    navigate(PATH.login)
  }

  // 모달의 [카메라 허용] 버튼 핸들러: getUserMedia 권한 요청 후 결과 반영.
  // 허용 성공 시에는 사용자가 [완료]를 눌러 닫도록 모달은 그대로 둔다.
  async function on_click_allow_camera() {
    const local_ok = await request_camera_permission()
    g_permission_state = local_ok ? 'granted' : 'denied'
  }

  // 모달의 [완료] 버튼 핸들러: 사용자가 직접 모달을 닫는다.
  function on_click_close_camera_modal() {
    g_permission_modal_open = false
  }

  onMount(() => {
    let local_unwatch = /** @type {(() => void) | null} */ (null)
    let local_cancelled = false

    ;(async () => {
      const local_state = await check_camera_permission_state()
      if (local_cancelled) return

      g_permission_state = local_state
      if (local_state !== 'granted' && local_state !== 'unsupported') {
        g_permission_modal_open = true
      }

      local_unwatch = await watch_camera_permission_change((local_next_state) => {
        g_permission_state = local_next_state
        if (local_next_state !== 'granted' && local_next_state !== 'unsupported') {
          g_permission_modal_open = true
        }
      })

      if (local_cancelled) {
        local_unwatch?.()
        local_unwatch = null
      }
    })()

    return () => {
      local_cancelled = true
      local_unwatch?.()
    }
  })
</script>

<main
  class="app-frame-page grid min-h-full grid-rows-[auto_1fr] overflow-hidden bg-[var(--retina-surface)] text-[var(--retina-text)]"
>
  <header
    class="flex items-center justify-between border-b border-[var(--retina-text-200)] bg-[var(--retina-surface)] px-6 py-3"
  >
    <button
      class="grid h-9 w-9 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-[var(--retina-text-700)] transition hover:bg-[var(--retina-bg-1)] hover:text-[var(--retina-primary-600)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retina-primary-600)]/60"
      type="button"
      aria-label="뒤로가기"
      onclick={on_click_go_back}
    >
      <ArrowLeft size={22} strokeWidth={2} aria-hidden="true" />
    </button>

    <img
      class="h-9 w-auto"
      src="/logo/LogoWide_2.png"
      alt="RetinaFit"
      width="320"
      height="80"
    />

    <button
      class="grid h-9 w-9 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-[var(--retina-text-700)] transition hover:bg-[var(--retina-bg-1)] hover:text-[var(--retina-primary-600)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retina-primary-600)]/60"
      type="button"
      aria-label="로그아웃"
      onclick={on_click_logout}
    >
      <LogOut size={22} strokeWidth={2} aria-hidden="true" />
    </button>
  </header>

  <CaptureShell />
</main>

<CameraPermissionModal
  open={g_permission_modal_open}
  permission_state={g_permission_state}
  onallow={on_click_allow_camera}
  onclose={on_click_close_camera_modal}
/>
