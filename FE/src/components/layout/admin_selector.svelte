<script>
  import { ChevronDown, UserRound } from 'lucide-svelte'

  const admin_arr = [
    { id: 1, name: '박점장', position: '지점장' },
    { id: 2, name: '김매니저', position: '매니저' },
    { id: 3, name: '이관리자', position: '관리자' },
  ]

  let ref_selected_admin_obj = $state(admin_arr[0])
  let ref_admin_dropdown_open = $state(false)

  function on_click_toggle_admin_dropdown() {
    ref_admin_dropdown_open = !ref_admin_dropdown_open
  }

  function on_click_select_admin(admin_obj) {
    ref_selected_admin_obj = admin_obj
    ref_admin_dropdown_open = false
  }

  function on_blur_admin_dropdown() {
    ref_admin_dropdown_open = false
  }
</script>

<div class="relative w-[190px]" onfocusout={on_blur_admin_dropdown}>
  <button
    class="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 text-left transition hover:border-[#4B0055]/30 hover:bg-[#F8F1F8] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/25"
    type="button"
    aria-haspopup="listbox"
    aria-expanded={ref_admin_dropdown_open}
    onclick={on_click_toggle_admin_dropdown}
  >
    <span class="flex min-w-0 items-center gap-2">
      <span
        class="grid h-8 w-8 flex-none place-items-center rounded-full bg-[#F5EAF7] text-[#4B0055]"
      >
        <UserRound size={18} strokeWidth={2.3} aria-hidden="true" />
      </span>
      <span class="min-w-0">
        <span class="block truncate text-sm font-extrabold text-zinc-950">
          {ref_selected_admin_obj.name}
        </span>
        <span class="block truncate text-xs font-bold text-slate-500">
          {ref_selected_admin_obj.position}
        </span>
      </span>
    </span>
    <ChevronDown
      class={`flex-none text-slate-400 transition ${ref_admin_dropdown_open ? 'rotate-180' : ''}`}
      size={17}
      strokeWidth={2.4}
      aria-hidden="true"
    />
  </button>

  {#if ref_admin_dropdown_open}
    <div
      class="absolute right-0 top-[calc(100%+8px)] z-30 w-full overflow-hidden rounded-xl border border-slate-200 bg-white py-2 text-left shadow-xl shadow-slate-900/12"
      role="listbox"
      aria-label="관리자 선택"
    >
      {#each admin_arr as admin_obj (admin_obj.id)}
        <button
          class={`flex min-h-12 w-full cursor-pointer items-center gap-3 border-0 px-4 text-left transition ${
            ref_selected_admin_obj.id === admin_obj.id
              ? 'bg-[#F8F1F8] text-[#4B0055]'
              : 'bg-white text-zinc-950 hover:bg-slate-50'
          }`}
          type="button"
          role="option"
          aria-selected={ref_selected_admin_obj.id === admin_obj.id}
          onclick={() => on_click_select_admin(admin_obj)}
        >
          <span
            class="grid h-8 w-8 flex-none place-items-center rounded-full bg-[#F5EAF7] text-sm font-extrabold text-[#4B0055]"
          >
            {admin_obj.name.slice(0, 1)}
          </span>
          <span class="min-w-0">
            <span class="block truncate text-sm font-extrabold">{admin_obj.name}</span>
            <span class="block truncate text-xs font-bold text-slate-500">
              {admin_obj.position}
            </span>
          </span>
        </button>
      {/each}
    </div>
  {/if}
</div>
