<script>
  import { onMount } from 'svelte'
  import { navigate } from '@maks11060/svelte5-router'
  import { ArrowLeft } from 'lucide-svelte'
  import CaptureShell from '@/components/capture/capture_shell.svelte'
  import CameraPermissionModal from '@/components/modal/camera_permission_modal.svelte'
  import { PATH } from '@/config/path'
  import {
    check_camera_permission_state,
    request_camera_permission,
    watch_camera_permission_change,
  } from '@/lib/capture/permission'
  import { selected_customer_obj } from '@/lib/stores/customer'

  let g_back_path = $derived(
    $selected_customer_obj?.id ? PATH.userDetail($selected_customer_obj.id) : PATH.users,
  )
  let g_permission_state = $state(/** @type {'granted' | 'denied' | 'prompt' | 'unsupported'} */ ('prompt'))
  let g_permission_modal_open = $state(false)

  // 뒤로가기 버튼 클릭 시 현재 선택된 고객의 상세 대시보드로 이동한다.
  function on_click_go_back() {
    navigate(g_back_path)
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

<main class="app-frame-page overflow-hidden bg-[#F7F8FA] text-zinc-950">
  <header
    class="grid h-[72px] grid-cols-[1fr_auto_1fr] items-center border-b border-slate-200 bg-white px-8"
  >
    <div class="flex justify-start">
      <button
        class="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-1 text-base font-bold text-slate-600 transition hover:text-[#4B0055] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#9A1BFF]/20"
        type="button"
        onclick={on_click_go_back}
      >
        <ArrowLeft size={20} strokeWidth={2.4} aria-hidden="true" />
        <span>뒤로가기</span>
      </button>
    </div>

    <h1 class="m-0 text-2xl font-extrabold tracking-normal text-zinc-950">얼굴 분석</h1>

    <div></div>
  </header>

  <section class="h-[calc(100%-72px)] overflow-y-auto px-8 py-4">
    <div class="mx-auto max-w-[1216px]">
      <CaptureShell />
    </div>
  </section>
</main>

<CameraPermissionModal
  open={g_permission_modal_open}
  permission_state={g_permission_state}
  onallow={on_click_allow_camera}
  onclose={on_click_close_camera_modal}
/>
