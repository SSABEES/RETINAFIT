<script>
  import { X } from 'lucide-svelte'

  /** @type {{
   *   open?: boolean,
   *   error_message?: string,
   *   onclose?: (() => void) | undefined,
   *   oncreate?: ((customer_obj: { name: string, gender: string, birth_dt: string, phone1: string, phone2: string }) => void | Promise<void>) | undefined,
   * }}
   */
  let { open = false, error_message = '', onclose = undefined, oncreate = undefined } = $props()

  let ref_name = $state('')
  let ref_gender = $state('0')
  let ref_birth_dt = $state('')
  let ref_phone1 = $state('')
  let ref_phone2 = $state('')
  let g_is_submit_loading = $state(false)

  // 신규 고객 등록 폼의 입력값을 초기화한다.
  function reset_form() {
    ref_name = ''
    ref_gender = '0'
    ref_birth_dt = ''
    ref_phone1 = ''
    ref_phone2 = ''
  }

  // 모달을 닫기 전에 폼 입력값을 초기화한다.
  function on_click_close() {
    if (g_is_submit_loading) {
      return
    }

    reset_form()
    onclose?.()
  }

  /**
   * 신규 고객 등록 폼 제출 시 고객 객체를 만들어 상위 컴포넌트로 전달한다.
   * @param {SubmitEvent} local_event
   */
  async function on_submit_customer_create(local_event) {
    local_event.preventDefault()

    const local_customer_obj = {
      name: ref_name.trim(),
      gender: ref_gender,
      birth_dt: ref_birth_dt,
      phone1: ref_phone1.trim(),
      phone2: ref_phone2.trim(),
    }

    g_is_submit_loading = true

    try {
      await oncreate?.(local_customer_obj)
    } finally {
      g_is_submit_loading = false
    }
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-50 grid place-items-center bg-black/45 px-5"
    role="presentation"
    onclick={on_click_close}
  >
    <div
      class="w-full max-w-[480px] overflow-hidden rounded-2xl bg-white text-left shadow-2xl shadow-black/25"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-create-title"
      tabindex="-1"
      onclick={(local_event) => local_event.stopPropagation()}
      onkeydown={(local_event) => local_event.stopPropagation()}
    >
      <header class="flex min-h-[66px] items-center justify-between bg-[#4B0055] px-7 text-white">
        <h2 id="customer-create-title" class="m-0 text-2xl font-extrabold">신규 고객 등록</h2>
        <button
          class="grid h-10 w-10 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-white transition hover:bg-white/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          aria-label="신규 고객 등록 닫기"
          disabled={g_is_submit_loading}
          onclick={on_click_close}
        >
          <X size={25} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </header>

      <form class="grid gap-5 px-7 py-6" onsubmit={on_submit_customer_create}>
        <label class="grid gap-2 text-base font-extrabold text-slate-700" for="customer-name">
          <span>이름 <span class="text-[#D92D20]">*</span></span>
          <input
            id="customer-name"
            class="min-h-13 rounded-lg border border-slate-200 px-4 text-lg font-semibold text-zinc-900 outline-none transition placeholder:text-slate-400 focus:border-[#9A1BFF] focus:ring-3 focus:ring-[#9A1BFF]/15 disabled:cursor-not-allowed disabled:bg-slate-50"
            type="text"
            maxlength="30"
            bind:value={ref_name}
            placeholder="고객 이름을 입력하세요"
            disabled={g_is_submit_loading}
            required
          />
        </label>

        <fieldset class="m-0 grid gap-3 border-0 p-0" disabled={g_is_submit_loading}>
          <legend class="text-base font-extrabold text-slate-700">
            성별 <span class="text-[#D92D20]">*</span>
          </legend>
          <div class="flex items-center gap-14 px-6">
            <label
              class="inline-flex cursor-pointer items-center gap-2 text-base font-bold text-zinc-900"
            >
              <input
                class="h-4 w-4 accent-[#4B0055]"
                type="radio"
                name="customer-gender"
                value="0"
                bind:group={ref_gender}
              />
              남
            </label>
            <label
              class="inline-flex cursor-pointer items-center gap-2 text-base font-bold text-zinc-900"
            >
              <input
                class="h-4 w-4 accent-[#4B0055]"
                type="radio"
                name="customer-gender"
                value="1"
                bind:group={ref_gender}
              />
              여
            </label>
          </div>
        </fieldset>

        <label class="grid gap-2 text-base font-extrabold text-slate-700" for="customer-birth-dt">
          <span>생년월일 <span class="text-[#D92D20]">*</span></span>
          <input
            id="customer-birth-dt"
            class="min-h-13 rounded-lg border border-slate-200 px-4 text-lg font-semibold text-zinc-900 outline-none transition placeholder:text-slate-400 focus:border-[#9A1BFF] focus:ring-3 focus:ring-[#9A1BFF]/15 disabled:cursor-not-allowed disabled:bg-slate-50"
            type="date"
            bind:value={ref_birth_dt}
            disabled={g_is_submit_loading}
            required
          />
        </label>

        <label class="grid gap-2 text-base font-extrabold text-slate-700" for="customer-phone1">
          <span>연락처1 <span class="text-[#D92D20]">*</span></span>
          <input
            id="customer-phone1"
            class="min-h-13 rounded-lg border border-slate-200 px-4 text-lg font-semibold text-zinc-900 outline-none transition placeholder:text-slate-400 focus:border-[#9A1BFF] focus:ring-3 focus:ring-[#9A1BFF]/15 disabled:cursor-not-allowed disabled:bg-slate-50"
            type="tel"
            inputmode="numeric"
            maxlength="11"
            bind:value={ref_phone1}
            placeholder="01012345678"
            disabled={g_is_submit_loading}
            required
          />
        </label>

        <label class="grid gap-2 text-base font-extrabold text-slate-700" for="customer-phone2">
          <span>연락처2</span>
          <input
            id="customer-phone2"
            class="min-h-13 rounded-lg border border-slate-200 px-4 text-lg font-semibold text-zinc-900 outline-none transition placeholder:text-slate-400 focus:border-[#9A1BFF] focus:ring-3 focus:ring-[#9A1BFF]/15 disabled:cursor-not-allowed disabled:bg-slate-50"
            type="tel"
            inputmode="numeric"
            maxlength="11"
            bind:value={ref_phone2}
            placeholder="01056785678"
            disabled={g_is_submit_loading}
          />
        </label>

        {#if error_message}
          <p class="m-0 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700" role="alert">
            {error_message}
          </p>
        {/if}

        <div class="mt-2 grid grid-cols-2 gap-3">
          <button
            class="min-h-13 cursor-pointer rounded-lg border border-slate-200 bg-white text-lg font-extrabold text-zinc-900 transition hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={g_is_submit_loading}
            onclick={on_click_close}
          >
            취소
          </button>
          <button
            class="min-h-13 cursor-pointer rounded-lg border-0 bg-[#4B0055] text-lg font-extrabold text-white transition hover:bg-[#65006F] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/30 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={g_is_submit_loading}
          >
            {g_is_submit_loading ? '등록 중' : '등록하기'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
