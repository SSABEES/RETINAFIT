<script>
  import { navigate } from '@maks11060/svelte5-router'
  import { Building2, Phone } from 'lucide-svelte'
  import { PATH } from '@/config/path'
  import {
    login_member_arr,
    opt_store_arr,
    set_selected_admin,
    set_selected_opt_store,
  } from '@/lib/stores/admin'

  /**
   * 안경사 원본 데이터에서 소속 안경원 번호를 읽는다.
   * @param {Record<string, unknown>} member_obj
   */
  function get_member_opt_no(member_obj) {
    return String(
      member_obj.opt_no ??
        member_obj.OPT_NO ??
        member_obj.OPTICIAN_OPT_NO ??
        member_obj.COMPANY_NO ??
        '',
    )
  }

  /**
   * 선택한 안경원 기준으로 안경사 목록을 필터링한다.
   * 응답에 안경원 번호가 없으면 현재 안경원 소속으로 간주하고 전체를 그대로 사용한다.
   * @param {Array<Record<string, unknown>>} member_arr
   * @param {string} opt_no
   */
  function filter_member_arr(member_arr, opt_no) {
    const local_has_opt_no = member_arr.some((member_obj) => get_member_opt_no(member_obj))

    if (!local_has_opt_no) {
      return member_arr
    }

    return member_arr.filter((member_obj) => get_member_opt_no(member_obj) === opt_no)
  }

  /**
   * 로그인 응답의 안경사 목록을 선택 화면이 쓰는 관리자 데이터 형태로 변환한다.
   * @param {Array<Record<string, unknown>>} member_arr
   * @param {{ opt_no: string, name: string, tel: string }} opt_store_obj
   */
  function normalize_member_arr(member_arr, opt_store_obj) {
    return member_arr.map((member_obj, local_index) => ({
      id: Number(member_obj.member_no ?? member_obj.MEMBER_NO ?? local_index + 1),
      member_no: Number(member_obj.member_no ?? member_obj.MEMBER_NO ?? 0),
      name: String(member_obj.member_name ?? member_obj.MEMBER_NAME ?? '안경사'),
      position: String(member_obj.position ?? member_obj.POSITION ?? '안경사'),
      password: '',
      mobile: String(member_obj.mobile ?? member_obj.MOBILE ?? ''),
      opt_no: opt_store_obj.opt_no,
      opt_name: opt_store_obj.name,
      company_tel: opt_store_obj.tel,
      raw_obj: member_obj,
    }))
  }

  /**
   * 안경원 카드를 선택하면 안경원과 안경사 선택 상태를 저장하고 다음 화면으로 이동한다.
   * @param {{ id: number, opt_no: string, name: string, tel: string, raw_obj?: Record<string, unknown> }} opt_store_obj
   */
  function on_click_select_store(opt_store_obj) {
    const local_member_arr = filter_member_arr($login_member_arr, opt_store_obj.opt_no)
    const local_admin_arr = normalize_member_arr(local_member_arr, opt_store_obj)

    if (local_admin_arr.length === 0) {
      return
    }

    set_selected_opt_store(opt_store_obj, local_admin_arr)
    set_selected_admin(local_admin_arr[0])
    navigate(PATH.opticianSelect)
  }

  // 로그인 화면으로 다시 돌아간다.
  function on_click_back_login() {
    navigate(PATH.login)
  }
</script>

<main class="app-frame-page overflow-hidden bg-[#11142A] text-white">
  <section
    class="relative grid min-h-full place-items-start justify-items-center px-6 pb-12 pt-24 before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_50%_12%,rgba(154,27,255,0.3),transparent_32%),linear-gradient(135deg,#11142A_0%,#4B0055_45%,#180F2E_100%)] before:content-['']"
    aria-labelledby="store-select-title"
  >
    <div class="relative z-10 flex h-full max-h-[820px] w-full max-w-[760px] flex-col items-center">
      <div class="mb-10 flex flex-col items-center text-center">
        <img
          class="mb-5 h-auto w-[148px] rounded-xl shadow-2xl shadow-black/20"
          src="/icnos.png"
          alt="Retin AI"
          width="900"
          height="900"
        />
        <h1 id="store-select-title" class="m-0 text-3xl font-extrabold tracking-normal text-white">
          안경원 선택
        </h1>
      </div>

      <section
        class="min-h-0 w-full rounded-[26px] border border-white/8 bg-white/12 px-9 py-8 shadow-2xl shadow-black/22 backdrop-blur-md"
        aria-label="안경원 목록"
      >
        {#if $opt_store_arr.length > 0}
          <div class="max-h-[430px] overflow-y-auto pr-1">
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {#each $opt_store_arr as opt_store_obj (opt_store_obj.id)}
                <button
                  class="group grid min-h-[128px] cursor-pointer grid-cols-[auto_1fr] items-center gap-4 rounded-lg border-2 border-transparent bg-white px-4 py-4 text-left text-zinc-950 shadow-lg shadow-black/10 transition duration-150 ease-out hover:-translate-y-1 hover:border-[#9A1BFF] hover:bg-[#F8F1F8] hover:shadow-2xl hover:shadow-violet-950/30 active:translate-y-0 active:scale-[0.99] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-white/70"
                  type="button"
                  onclick={() => on_click_select_store(opt_store_obj)}
                >
                  <span
                    class="grid h-12 w-12 flex-none place-items-center rounded-full bg-[#F5EAF7] text-[#4B0055] transition duration-150 group-hover:bg-[#4B0055] group-hover:text-white group-hover:shadow-lg group-hover:shadow-[#4B0055]/25"
                  >
                    <Building2 size={25} strokeWidth={2.3} aria-hidden="true" />
                  </span>

                  <span class="min-w-0">
                    <span class="block truncate text-xl font-extrabold text-zinc-950">
                      {opt_store_obj.name}
                    </span>
                    {#if opt_store_obj.tel}
                      <span
                        class="mt-2 flex items-center gap-2 truncate text-sm font-bold text-slate-500"
                      >
                        <Phone size={16} strokeWidth={2.2} aria-hidden="true" />
                        <span class="truncate">{opt_store_obj.tel}</span>
                      </span>
                    {/if}
                  </span>
                </button>
              {/each}
            </div>
          </div>
        {:else}
          <div class="grid place-items-center gap-5 rounded-lg bg-white px-6 py-10 text-center">
            <p class="m-0 text-lg font-extrabold text-zinc-950">
              선택 가능한 안경원 정보가 없습니다.
            </p>
            <button
              class="min-h-12 cursor-pointer rounded-lg border-0 bg-[#4B0055] px-6 text-base font-extrabold text-white transition hover:bg-[#65006F] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/30"
              type="button"
              onclick={on_click_back_login}
            >
              로그인으로 돌아가기
            </button>
          </div>
        {/if}
      </section>
    </div>

    <p
      class="absolute bottom-10 left-1/2 z-10 m-0 -translate-x-1/2 text-base font-medium text-white/42"
    >
      © 2026 RETINA. All rights reserved.
    </p>
  </section>
</main>
