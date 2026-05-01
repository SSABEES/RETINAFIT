<script>
  import { onMount } from 'svelte'
  import { navigate } from '@maks11060/svelte5-router'
  import CaptureShell from '@/components/capture/capture_shell.svelte'
  import Header from '@/components/layout/header.svelte'
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

  // ?ㅻ뜑???ㅻ줈媛湲???怨좉컼 議고쉶 ?붾㈃?쇰줈 ?뚯븘媛꾨떎.
  function on_click_go_back() {
    navigate(PATH.users)
  }

  // ?ㅻ뜑??濡쒓렇?꾩썐 ???좏겙/?먮룞濡쒓렇???ㅽ넗?대? 鍮꾩슦怨?濡쒓렇???붾㈃?쇰줈 ?대룞?쒕떎.
  function on_click_logout() {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('token_no')
    clear_login_select_data()
    clear_auto_login_obj()
    navigate(PATH.login)
  }

  // 紐⑤떖??[移대찓???덉슜] 踰꾪듉 ?몃뱾?? getUserMedia 沅뚰븳 ?붿껌 ??寃곌낵 諛섏쁺.
  // ?덉슜 ?깃났 ?쒖뿉???ъ슜?먭? [?꾨즺]瑜??뚮윭 ?ル룄濡?紐⑤떖? 洹몃?濡??붾떎.
  async function on_click_allow_camera() {
    const local_ok = await request_camera_permission()
    g_permission_state = local_ok ? 'granted' : 'denied'
  }

  // 紐⑤떖??[?꾨즺] 踰꾪듉 ?몃뱾?? ?ъ슜?먭? 吏곸젒 紐⑤떖???ル뒗??
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
  <Header onback={on_click_go_back} onlogout={on_click_logout} />

  <CaptureShell />
</main>

<CameraPermissionModal
  open={g_permission_modal_open}
  permission_state={g_permission_state}
  onallow={on_click_allow_camera}
  onclose={on_click_close_camera_modal}
/>

