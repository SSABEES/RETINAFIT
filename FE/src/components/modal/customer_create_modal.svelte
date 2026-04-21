<script>
  import { X } from 'lucide-svelte'

  /** @type {{
   *   open?: boolean,
   *   onclose?: (() => void) | undefined,
   *   oncreate?: ((customer_obj: { name: string, gender: string, birth_dt: string, phone: string }) => void) | undefined,
   * }}
   */
  let { open = false, onclose = undefined, oncreate = undefined } = $props()

  let ref_name = $state('')
  let ref_gender = $state('남성')
  let ref_birth_dt = $state('')
  let ref_phone = $state('')

  function reset_form() {
    ref_name = ''
    ref_gender = '남성'
    ref_birth_dt = ''
    ref_phone = ''
  }

  function on_click_close() {
    reset_form()
    onclose?.()
  }

  /** @param {SubmitEvent} event */
  function on_submit_customer_create(event) {
    event.preventDefault()

    const local_customer_obj = {
      name: ref_name.trim(),
      gender: ref_gender,
      birth_dt: ref_birth_dt,
      phone: ref_phone.trim(),
    }

    oncreate?.(local_customer_obj)
    reset_form()
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
      onclick={(event) => event.stopPropagation()}
      onkeydown={(event) => event.stopPropagation()}
    >
      <header class="flex min-h-[66px] items-center justify-between bg-[#4B0055] px-7 text-white">
        <h2 id="customer-create-title" class="m-0 text-2xl font-extrabold">신규 고객 등록</h2>
        <button
          class="grid h-10 w-10 cursor-pointer place-items-center rounded-lg border-0 bg-transparent text-white transition hover:bg-white/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
          type="button"
          aria-label="신규 고객 등록 닫기"
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
            class="min-h-13 rounded-lg border border-slate-200 px-4 text-lg font-semibold text-zinc-900 outline-none transition placeholder:text-slate-400 focus:border-[#9A1BFF] focus:ring-3 focus:ring-[#9A1BFF]/15"
            type="text"
            bind:value={ref_name}
            placeholder="고객 이름을 입력하세요"
            required
          />
        </label>

        <fieldset class="m-0 grid gap-3 border-0 p-0">
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
                value="남성"
                bind:group={ref_gender}
              />
              남성
            </label>
            <label
              class="inline-flex cursor-pointer items-center gap-2 text-base font-bold text-zinc-900"
            >
              <input
                class="h-4 w-4 accent-[#4B0055]"
                type="radio"
                name="customer-gender"
                value="여성"
                bind:group={ref_gender}
              />
              여성
            </label>
          </div>
        </fieldset>

        <label class="grid gap-2 text-base font-extrabold text-slate-700" for="customer-birth-dt">
          <span>생년월일 <span class="text-[#D92D20]">*</span></span>
          <input
            id="customer-birth-dt"
            class="min-h-13 rounded-lg border border-slate-200 px-4 text-lg font-semibold text-zinc-900 outline-none transition placeholder:text-slate-400 focus:border-[#9A1BFF] focus:ring-3 focus:ring-[#9A1BFF]/15"
            type="date"
            bind:value={ref_birth_dt}
            required
          />
        </label>

        <label class="grid gap-2 text-base font-extrabold text-slate-700" for="customer-phone">
          <span>전화번호 <span class="text-[#D92D20]">*</span></span>
          <input
            id="customer-phone"
            class="min-h-13 rounded-lg border border-slate-200 px-4 text-lg font-semibold text-zinc-900 outline-none transition placeholder:text-slate-400 focus:border-[#9A1BFF] focus:ring-3 focus:ring-[#9A1BFF]/15"
            type="tel"
            bind:value={ref_phone}
            placeholder="010-1234-5678"
            required
          />
        </label>

        <div class="mt-2 grid grid-cols-2 gap-3">
          <button
            class="min-h-13 cursor-pointer rounded-lg border border-slate-200 bg-white text-lg font-extrabold text-zinc-900 transition hover:bg-slate-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-slate-300"
            type="button"
            onclick={on_click_close}
          >
            취소
          </button>
          <button
            class="min-h-13 cursor-pointer rounded-lg border-0 bg-[#4B0055] text-lg font-extrabold text-white transition hover:bg-[#65006F] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/30"
            type="submit"
          >
            등록하기
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
