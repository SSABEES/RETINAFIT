<script>
  import { Link } from '@maks11060/svelte5-router'
  import {
    BarChart3,
    Building2,
    CircleHelp,
    Users,
  } from 'lucide-svelte'
  import { PATH } from '@/config/path'

  /** @type {{ active_key?: string }} */
  let { active_key = '' } = $props()

  // 사이드바 항목은 여기에서만 관리해 신규 페이지 추가 시 확장하기 쉽게 유지합니다.
  const menu_arr = [
    { key: 'users', label: '고객 관리', href: PATH.users, icon: Users },
    { key: 'sales', label: '판매 통계', href: PATH.sales, icon: BarChart3 },
    { key: 'branches', label: '지점 관리', href: PATH.branches, icon: Building2 },
  ]
</script>

<aside
  class="grid h-full min-h-0 max-h-full w-[240px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-[#4B0055] text-white"
>
  <div class="flex items-center gap-3 px-6 py-6">
    <img
      class="h-11 w-11 rounded-lg bg-white object-cover shadow-lg shadow-black/20"
      src="/favicon.png"
      alt="Retin AI"
      width="900"
      height="900"
    />
    <div class="text-left">
      <p class="m-0 text-3xl font-extrabold leading-6">RetinAI</p>
    </div>
  </div>

  <nav class="grid content-start gap-2 px-4 py-4" aria-label="관리 메뉴">
    {#each menu_arr as menu_obj (menu_obj.key)}
      <Link
        class={`flex min-h-11 items-center gap-3 rounded-lg px-4 text-base font-bold transition ${
          active_key === menu_obj.key
            ? 'bg-white/18 text-white shadow-sm shadow-black/10'
            : 'text-white/78 hover:bg-white/10 hover:text-white'
        }`}
        href={menu_obj.href}
      >
        <menu_obj.icon size={21} strokeWidth={2.2} aria-hidden="true" />
        <span>{menu_obj.label}</span>
      </Link>
    {/each}
  </nav>

  <div class="grid gap-2 border-t border-white/10 px-4 py-5">
    <button
      class="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2.5 text-base font-bold text-white/78 transition hover:bg-white/10 hover:text-white"
      type="button"
    >
      <CircleHelp size={20} strokeWidth={2.2} aria-hidden="true" />
      <span class="whitespace-nowrap">도움이 필요하신가요?</span>
    </button>
  </div>
</aside>
