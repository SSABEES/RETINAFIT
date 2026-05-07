<script>
  import { X } from 'lucide-svelte'
  import DatePicker from '@/components/input/date_picker.svelte'
  import { push_error_toast } from '@/lib/stores/toast'

  /**
   * @typedef {{ name: string, gender: string, birth_dt: string, phone1: string, phone2: string }} CustomerCreatePayload
   *
   * @typedef {object} CustomerCreateModalProps
   * @property {boolean} [open]
   * @property {(() => void) | undefined} [onclose]
   * @property {((customer_obj: CustomerCreatePayload) => void | Promise<void>) | undefined} [oncreate]
   */

  /** @type {CustomerCreateModalProps} */
  let { open = false, onclose = undefined, oncreate = undefined } = $props()

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

  function on_change_birth_dt(value_str) {
    ref_birth_dt = value_str
  }

  /**
   * 신규 고객 등록 폼 제출 시 고객 객체를 만들어 상위 컴포넌트로 전달한다.
   * @param {SubmitEvent} local_event
   */
  async function on_submit_customer_create(local_event) {
    local_event.preventDefault()

    if (!ref_birth_dt) {
      push_error_toast('생년월일을 선택해 주세요.')
      return
    }

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
  <!--
    .app-frame 의 transform: scale 이 fixed containing block 을 만들기 때문에 inset-0 만으로는
    .app-frame 안쪽까지만 덮인다. .app-edge-extend (negative left/right) 를 같이 걸어
    좌우 viewport 끝까지 오버레이가 닿게 한다.
  -->
  <div
    class="app-edge-extend fixed inset-y-0 z-50 grid place-items-center bg-black/40 px-5"
    role="presentation"
    onclick={on_click_close}
  >
    <div
      class="w-full max-w-[380px] rounded-[18px] border border-[var(--retina-text-200)] bg-[var(--retina-surface)] text-left shadow-[0_12px_30px_rgba(19,25,40,0.18)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-create-title"
      tabindex="-1"
      onclick={(local_event) => local_event.stopPropagation()}
      onkeydown={(local_event) => local_event.stopPropagation()}
    >
      <header
        class="flex min-h-10 items-center justify-between rounded-t-[18px] border-b border-[var(--retina-text-200)] bg-[var(--retina-surface)] px-4 py-2"
      >
        <h2
          id="customer-create-title"
          class="m-0 text-base font-extrabold text-[var(--retina-text-800)]"
        >
          신규 고객 등록
        </h2>
        <button
          class="grid h-8 w-8 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-[var(--retina-text-700)] transition hover:bg-[var(--retina-bg-1)] hover:text-[var(--retina-primary-600)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--retina-primary-600)]/60 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          aria-label="신규 고객 등록 닫기"
          disabled={g_is_submit_loading}
          onclick={on_click_close}
        >
          <X size={18} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </header>

      <form class="grid gap-2 px-4 py-3" onsubmit={on_submit_customer_create}>
        <label
          class="grid gap-1 text-xs font-bold text-[var(--retina-text-700)]"
          for="customer-name"
        >
          <span>이름 <span class="text-[#dc2626]">*</span></span>
          <input
            id="customer-name"
            class="min-h-9 rounded-md border border-[var(--retina-text-300)] bg-[var(--retina-surface)] px-3 text-sm font-semibold text-[var(--retina-text-800)] outline-none transition placeholder:text-[var(--retina-text-500)] focus:border-[var(--retina-text-800)] focus:bg-[var(--retina-bg-1)]/40 disabled:cursor-not-allowed disabled:bg-[var(--retina-text-200)]/40"
            type="text"
            maxlength="30"
            bind:value={ref_name}
            placeholder="고객 이름을 입력하세요"
            disabled={g_is_submit_loading}
            required
          />
        </label>

        <div class="grid grid-cols-2 gap-3">
          <fieldset class="m-0 grid gap-1 border-0 p-0" disabled={g_is_submit_loading}>
            <legend class="text-xs font-bold text-[var(--retina-text-700)]">
              성별 <span class="text-[#dc2626]">*</span>
            </legend>
            <div class="flex min-h-9 items-center gap-5 px-1">
              <label
                class="inline-flex cursor-pointer items-center gap-1.5 text-sm font-bold text-[var(--retina-text-800)]"
              >
                <input
                  class="h-3.5 w-3.5 accent-[var(--retina-primary-600)]"
                  type="radio"
                  name="customer-gender"
                  value="0"
                  bind:group={ref_gender}
                />
                남
              </label>
              <label
                class="inline-flex cursor-pointer items-center gap-1.5 text-sm font-bold text-[var(--retina-text-800)]"
              >
                <input
                  class="h-3.5 w-3.5 accent-[var(--retina-primary-600)]"
                  type="radio"
                  name="customer-gender"
                  value="1"
                  bind:group={ref_gender}
                />
                여
              </label>
            </div>
          </fieldset>

          <div class="grid gap-1 text-xs font-bold text-[var(--retina-text-700)]">
            <label for="customer-birth-dt">
              <span>생년월일 <span class="text-[#dc2626]">*</span></span>
            </label>
            <DatePicker
              id="customer-birth-dt"
              value={ref_birth_dt}
              placeholder="생년월일 선택"
              disabled={g_is_submit_loading}
              required
              aria_label="생년월일 선택"
              onchange={on_change_birth_dt}
            />
          </div>
        </div>

        <label
          class="grid gap-1 text-xs font-bold text-[var(--retina-text-700)]"
          for="customer-phone1"
        >
          <span>연락처1 <span class="text-[#dc2626]">*</span></span>
          <input
            id="customer-phone1"
            class="min-h-9 rounded-md border border-[var(--retina-text-300)] bg-[var(--retina-surface)] px-3 text-sm font-semibold text-[var(--retina-text-800)] outline-none transition placeholder:text-[var(--retina-text-500)] focus:border-[var(--retina-text-800)] focus:bg-[var(--retina-bg-1)]/40 disabled:cursor-not-allowed disabled:bg-[var(--retina-text-200)]/40"
            type="tel"
            inputmode="numeric"
            maxlength="11"
            bind:value={ref_phone1}
            placeholder="01012345678"
            disabled={g_is_submit_loading}
            required
          />
        </label>

        <label
          class="grid gap-1 text-xs font-bold text-[var(--retina-text-700)]"
          for="customer-phone2"
        >
          <span>연락처2</span>
          <input
            id="customer-phone2"
            class="min-h-9 rounded-md border border-[var(--retina-text-300)] bg-[var(--retina-surface)] px-3 text-sm font-semibold text-[var(--retina-text-800)] outline-none transition placeholder:text-[var(--retina-text-500)] focus:border-[var(--retina-text-800)] focus:bg-[var(--retina-bg-1)]/40 disabled:cursor-not-allowed disabled:bg-[var(--retina-text-200)]/40"
            type="tel"
            inputmode="numeric"
            maxlength="11"
            bind:value={ref_phone2}
            placeholder="01056785678"
            disabled={g_is_submit_loading}
          />
        </label>

        <div class="grid grid-cols-2 gap-2">
          <button
            class="min-h-9 cursor-pointer rounded-md border border-[var(--retina-text-300)] bg-[var(--retina-surface)] text-sm font-extrabold text-[var(--retina-text-700)] transition hover:bg-[var(--retina-bg-1)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retina-text-300)]/70 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={g_is_submit_loading}
            onclick={on_click_close}
          >
            취소
          </button>
          <button
            class="min-h-9 cursor-pointer rounded-md border-0 bg-[var(--retina-primary-600)] text-sm font-extrabold text-[var(--retina-text-100)] transition hover:bg-[var(--retina-primary-700)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--retina-primary-600)]/40 disabled:cursor-not-allowed disabled:opacity-60"
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
