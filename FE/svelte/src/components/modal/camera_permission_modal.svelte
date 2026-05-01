<script>
  import { Camera, CheckCircle2, ShieldAlert } from 'lucide-svelte'

  /**
   * @type {{
   *   open?: boolean,
   *   permission_state?: 'granted' | 'denied' | 'prompt' | 'unsupported',
   *   onallow?: (() => void) | undefined,
   *   onclose?: (() => void) | undefined,
   * }}
   */
  let {
    open = false,
    permission_state = 'prompt',
    onallow = undefined,
    onclose = undefined,
  } = $props()

  const g_is_granted = $derived(permission_state === 'granted')
  const g_is_denied = $derived(permission_state === 'denied')

  // 카메라 허용 버튼: 부모가 getUserMedia 요청을 트리거하도록 위임한다.
  function on_click_allow() {
    onallow?.()
  }

  // 완료 버튼: 권한이 허용된 후 사용자가 직접 모달을 닫을 때 호출한다.
  function on_click_close() {
    onclose?.()
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/55 px-5" role="presentation">
    <div
      class="relative w-full max-w-md rounded-2xl bg-white p-7 text-left shadow-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-permission-title"
    >
      <div
        class={`grid h-14 w-14 place-items-center rounded-full ${
          g_is_granted ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#F5EAF7] text-[#4B0055]'
        }`}
      >
        {#if g_is_granted}
          <CheckCircle2 size={26} strokeWidth={2.3} aria-hidden="true" />
        {:else if g_is_denied}
          <ShieldAlert size={26} strokeWidth={2.3} aria-hidden="true" />
        {:else}
          <Camera size={26} strokeWidth={2.3} aria-hidden="true" />
        {/if}
      </div>

      <h2 id="camera-permission-title" class="mt-5 text-xl font-extrabold text-zinc-950">
        {g_is_granted ? '카메라 권한이 허용되었습니다' : '카메라 권한이 필요합니다'}
      </h2>

      {#if g_is_granted}
        <p class="mt-3 text-sm font-semibold leading-6 text-slate-600">
          이제 얼굴 분석과 AR 피팅을 진행할 수 있습니다. [완료]를 눌러 시작해 주세요.
        </p>
      {:else if g_is_denied}
        <p class="mt-3 text-sm font-semibold leading-6 text-slate-600">
          얼굴 분석과 AR 피팅에 카메라가 필요합니다. 브라우저 주소창의 자물쇠 아이콘에서 카메라
          권한을 허용한 뒤 페이지를 새로고침해 주세요.
        </p>
      {:else}
        <p class="mt-3 text-sm font-semibold leading-6 text-slate-600">
          얼굴 분석과 AR 피팅에 카메라가 필요합니다. 아래 버튼을 누른 뒤 브라우저 안내에서 허용해
          주세요.
        </p>
      {/if}

      <div class="mt-6">
        {#if g_is_granted}
          <button
            class="min-h-12 w-full cursor-pointer rounded-lg border-0 bg-[#15803D] px-6 text-base font-extrabold text-white transition hover:bg-[#0F6A30] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#15803D]/30"
            type="button"
            onclick={on_click_close}
          >
            완료
          </button>
        {:else}
          <button
            class="min-h-12 w-full cursor-pointer rounded-lg border-0 bg-[#4B0055] px-6 text-base font-extrabold text-white transition hover:bg-[#65006F] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/30 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={g_is_denied}
            onclick={on_click_allow}
          >
            {g_is_denied ? '브라우저 설정에서 권한을 켜주세요' : '카메라 허용'}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}
