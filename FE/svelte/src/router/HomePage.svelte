<script>
  import { onMount } from 'svelte'
  import { navigate } from '@maks11060/svelte5-router'
  import { PATH } from '@/config/path'

  /**
   * Admin (안경원 관리자) 환경 여부 판별.
   * Windows 또는 macOS PC 면 admin, 그 외(안드로이드 태블릿/iPadOS 등)는 안경사용 일반 로그인.
   *
   * iPadOS 13+ 는 desktop mode 에서 UA 가 "Macintosh" + touch 지원으로 보고되므로 Mac 으로
   * 오인식되지 않도록 별도 가드. iPhone/iPad/iPod 도 명시적으로 제외.
   */
  function detect_is_admin_os() {
    if (typeof navigator === 'undefined') return false

    const local_user_agent = String(navigator.userAgent ?? '')
    const local_platform = String(navigator.platform ?? '')
    const local_ua_data_platform = String(
      /** @type {any} */ (navigator).userAgentData?.platform ?? '',
    ).toLowerCase()

    // iPad/iPhone 류 — 매장 안경사 흐름. admin 아님.
    if (/iPad|iPhone|iPod/i.test(local_user_agent)) return false
    // iPadOS 13+ 의 desktop mode UA 우회: Macintosh + touch 면 iPad 로 간주.
    if (/Macintosh/i.test(local_user_agent) && (navigator.maxTouchPoints ?? 0) > 1) return false

    // Windows 신호
    if (local_ua_data_platform.includes('windows')) return true
    if (/Windows/i.test(local_user_agent)) return true
    if (/Win/i.test(local_platform)) return true

    // macOS 신호
    if (local_ua_data_platform.includes('macos') || local_ua_data_platform.includes('mac'))
      return true
    if (/Mac OS X|Macintosh/i.test(local_user_agent)) return true
    if (/Mac/i.test(local_platform)) return true

    return false
  }

  // 진입 시 OS 를 확인해 Windows/macOS 면 관리자 로그인으로, 그 외 (안드로이드 태블릿/iPad 등) 는
  // 일반 로그인으로 즉시 redirect 한다. home 화면 자체는 더 이상 노출되지 않는다.
  onMount(() => {
    if (detect_is_admin_os()) {
      navigate(PATH.adminLogin)
    } else {
      navigate(PATH.login)
    }
  })
</script>

<!-- redirect 가 즉시 일어나므로 별도 UI 는 보이지 않는다. -->
<main class="min-h-screen bg-[#F7F8FA]"></main>
