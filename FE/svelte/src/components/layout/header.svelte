<script>
  import { ArrowLeft, LogOut } from 'lucide-svelte'

  /** @type {{ onback?: (() => void) | undefined, onlogout?: (() => void) | undefined }} */
  let { onback = undefined, onlogout = undefined } = $props()

  function handle_back_click() {
    onback?.()
  }

  function handle_logout_click() {
    onlogout?.()
  }
</script>

<header class="grid h-[52px] shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-slate-200 px-6">
  <div class="flex justify-start">
    <button
      class="grid h-8 w-8 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
      type="button"
      aria-label="뒤로가기"
      onclick={handle_back_click}
    >
      <ArrowLeft size={24} strokeWidth={2.2} aria-hidden="true" />
    </button>
  </div>

  <img
    class="h-6 w-auto"
    src="/logo/LogoWide_2.png"
    alt="Retina Fit"
    width="240"
    height="52"
  />

  <div class="flex justify-end">
    <button
      class="grid h-8 w-8 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
      type="button"
      aria-label="로그아웃"
      onclick={handle_logout_click}
    >
      <LogOut size={22} strokeWidth={2.2} aria-hidden="true" />
    </button>
  </div>
</header>
