<script>
  import { ChevronDown, UserRound } from 'lucide-svelte'
  import { admin_arr, selected_admin_obj } from '@/lib/stores/admin'

  let ref_admin_dropdown_open = $state(false)
  let ref_admin_confirm_modal_open = $state(false)
  let ref_admin_password = $state('')
  let ref_admin_password_error = $state('')
  let ref_pending_admin_obj = $state(null)

  // 안경사 선택 드롭다운의 열림 상태를 전환한다.
  function on_click_toggle_admin_dropdown() {
    ref_admin_dropdown_open = !ref_admin_dropdown_open
  }

  // 변경할 안경사를 선택하고 비밀번호 확인 모달을 준비한다.
  function on_click_select_admin(admin_obj) {
    ref_admin_dropdown_open = false

    if ($selected_admin_obj.id === admin_obj.id) {
      return
    }

    ref_pending_admin_obj = admin_obj
    ref_admin_password = ''
    ref_admin_password_error = ''
    ref_admin_confirm_modal_open = true
  }

  // 안경사 선택 드롭다운을 닫는다.
  function on_click_close_admin_dropdown() {
    ref_admin_dropdown_open = false
  }

  // 안경사 변경 확인 모달을 닫고 입력 상태를 초기화한다.
  function on_click_close_admin_confirm_modal() {
    ref_admin_confirm_modal_open = false
    ref_pending_admin_obj = null
    ref_admin_password = ''
    ref_admin_password_error = ''
  }

  /**
   * 안경사 변경 확인 폼 제출 시 비밀번호를 검증하고 선택 안경사를 변경한다.
   * @param {SubmitEvent} local_event
   */
  function on_submit_admin_confirm(local_event) {
    local_event.preventDefault()

    if (!ref_pending_admin_obj) {
      return
    }

    if (ref_admin_password.length !== 4) {
      ref_admin_password_error = '비밀번호 4자리를 입력해주세요.'
      return
    }

    if (ref_admin_password !== ref_pending_admin_obj.password) {
      ref_admin_password_error = '비밀번호가 일치하지 않습니다.'
      return
    }

    selected_admin_obj.set(ref_pending_admin_obj)
    on_click_close_admin_confirm_modal()
  }
</script>

<svelte:window onclick={on_click_close_admin_dropdown} />

<div
  class="relative w-[190px]"
  role="presentation"
  onclick={(local_event) => local_event.stopPropagation()}
>
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
          {$selected_admin_obj.name}
        </span>
        <span class="block truncate text-xs font-bold text-slate-500">
          {$selected_admin_obj.position}
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
      {#each $admin_arr as admin_obj (admin_obj.id)}
        <button
          class={`flex min-h-12 w-full cursor-pointer items-center gap-3 border-0 px-4 text-left transition ${
            $selected_admin_obj.id === admin_obj.id
              ? 'bg-[#F8F1F8] text-[#4B0055]'
              : 'bg-white text-zinc-950 hover:bg-slate-50'
          }`}
          type="button"
          role="option"
          aria-selected={$selected_admin_obj.id === admin_obj.id}
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

{#if ref_admin_confirm_modal_open && ref_pending_admin_obj}
  <div
    class="fixed inset-0 z-50 grid place-items-center bg-black/45 px-5"
    role="presentation"
    onclick={on_click_close_admin_confirm_modal}
  >
    <div
      class="w-full max-w-[420px] overflow-hidden rounded-2xl bg-white text-left shadow-2xl shadow-black/25"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-confirm-title"
      tabindex="-1"
      onclick={(local_event) => local_event.stopPropagation()}
      onkeydown={(local_event) => local_event.stopPropagation()}
    >
      <header class="bg-[#4B0055] px-7 py-5 text-white">
        <p class="m-0 text-sm font-bold text-white/70">담당자 변경</p>
        <h2 id="admin-confirm-title" class="m-0 mt-1 text-2xl font-extrabold">
          {ref_pending_admin_obj.name}님이십니까?
        </h2>
      </header>

      <form class="grid gap-5 px-7 py-6" onsubmit={on_submit_admin_confirm}>
        <label class="grid gap-2 text-base font-extrabold text-slate-700" for="admin-password">
          <span>비밀번호 4자리 <span class="text-[#D92D20]">*</span></span>
          <input
            id="admin-password"
            class="min-h-13 rounded-lg border border-slate-200 px-4 text-lg font-semibold text-zinc-900 outline-none transition placeholder:text-slate-400 focus:border-[#9A1BFF] focus:ring-3 focus:ring-[#9A1BFF]/15"
            type="password"
            inputmode="numeric"
            pattern="[0-9]{4}"
            maxlength="4"
            bind:value={ref_admin_password}
            placeholder="비밀번호를 입력하세요"
            aria-invalid={ref_admin_password_error ? 'true' : 'false'}
            aria-describedby={ref_admin_password_error ? 'admin-password-error' : undefined}
            required
          />
        </label>

        {#if ref_admin_password_error}
          <p id="admin-password-error" class="m-0 text-sm font-bold text-[#D92D20]">
            {ref_admin_password_error}
          </p>
        {/if}

        <div class="grid grid-cols-2 gap-3">
          <button
            class="min-h-13 cursor-pointer rounded-lg border border-slate-200 bg-white text-lg font-extrabold text-zinc-900 transition hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
            type="button"
            onclick={on_click_close_admin_confirm_modal}
          >
            취소
          </button>
          <button
            class="min-h-13 cursor-pointer rounded-lg border-0 bg-[#4B0055] text-lg font-extrabold text-white transition hover:bg-[#65006F] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/30"
            type="submit"
          >
            확인
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
