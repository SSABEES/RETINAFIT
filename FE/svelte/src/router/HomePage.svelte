<script>
  import { onMount } from 'svelte'
  import { navigate } from '@maks11060/svelte5-router'
  import { PATH } from '@/config/path'

  /**
   * Windows 환경 여부를 여러 신호로 판별한다.
   * - userAgentData.platform (modern Chromium UA-CH)
   * - userAgent 문자열
   * - platform 문자열 (deprecated 이지만 fallback 으로 유효)
   */
  function detect_is_windows() {
    if (typeof navigator === 'undefined') return false

    const local_ua_data_platform = String(
      /** @type {any} */ (navigator).userAgentData?.platform ?? '',
    ).toLowerCase()
    if (local_ua_data_platform.includes('windows')) return true

    const local_user_agent = String(navigator.userAgent ?? '')
    if (/Windows/i.test(local_user_agent)) return true

    const local_platform = String(navigator.platform ?? '')
    if (/Win/i.test(local_platform)) return true

    return false
  }

  // 진입 시 OS 를 확인해 Windows 면 관리자 로그인으로, 그 외 (안드로이드 태블릿 등) 는
  // 일반 로그인으로 즉시 redirect 한다. home 화면 자체는 더 이상 노출되지 않는다.
  onMount(() => {
    if (detect_is_windows()) {
      navigate(PATH.adminLogin)
    } else {
      navigate(PATH.login)
    }
  })
</script>

<!-- redirect 가 즉시 일어나므로 별도 UI 는 보이지 않는다. -->
<main class="min-h-screen bg-[#F7F8FA]"></main>
