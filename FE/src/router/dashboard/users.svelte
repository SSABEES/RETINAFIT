<script>
  import { link } from '@maks11060/svelte5-router'
  import { CalendarDays, Phone, Search, UserPlus } from 'lucide-svelte'
  import DashboardShell from '../../components/layout/dashboard_shell.svelte'
  import CustomerCreateModal from '../../components/modal/customer_create_modal.svelte'
  import { PATH } from '../../config/path'

  // API 연동 전까지 화면 구조를 검증하기 위한 고객 목록 임시 데이터입니다.
  let ref_customer_arr = $state([
    {
      id: 1,
      name: '김민준',
      phone: '010-1234-5678',
      last_visit_dt: '2026-04-10',
      visit_count: 3,
      status: '분석완료',
    },
    {
      id: 2,
      name: '이서연',
      phone: '010-2345-6789',
      last_visit_dt: '2026-04-14',
      visit_count: 5,
      status: '분석완료',
    },
    {
      id: 3,
      name: '박지훈',
      phone: '010-3456-7890',
      last_visit_dt: '2026-03-28',
      visit_count: 2,
      status: '',
    },
    {
      id: 4,
      name: '최수빈',
      phone: '010-4567-8901',
      last_visit_dt: '2026-04-12',
      visit_count: 7,
      status: '분석완료',
    },
    {
      id: 5,
      name: '정도윤',
      phone: '010-5678-9012',
      last_visit_dt: '2026-04-18',
      visit_count: 1,
      status: '',
    },
  ])

  let ref_customer_create_modal_open = $state(false)

  const get_initial = (name) => name.slice(0, 1)

  function on_click_open_customer_create_modal() {
    ref_customer_create_modal_open = true
  }

  function on_click_close_customer_create_modal() {
    ref_customer_create_modal_open = false
  }

  function on_create_customer(customer_obj) {
    const local_registered_dt = new Date().toISOString().slice(0, 10)
    const local_new_customer_obj = {
      id: Date.now(),
      name: customer_obj.name,
      phone: customer_obj.phone,
      last_visit_dt: local_registered_dt,
      visit_count: 0,
      status: '',
    }

    ref_customer_arr = [local_new_customer_obj, ...ref_customer_arr]
    ref_customer_create_modal_open = false
  }
</script>

<DashboardShell active_key="users" title="고객 관리">
  <section class="px-10 py-12">
    <div class="mx-auto max-w-[980px]">
      <label class="relative mx-auto block w-full max-w-[720px]" for="customer-search">
        <Search
          class="pointer-events-none absolute left-7 top-1/2 -translate-y-1/2 text-slate-400"
          size={26}
          strokeWidth={2.2}
          aria-hidden="true"
        />
        <input
          id="customer-search"
          class="min-h-[72px] w-full rounded-2xl border border-[#E7E9F0] bg-white pl-[68px] pr-7 text-xl font-semibold text-zinc-900 outline-none transition placeholder:text-slate-400 focus:border-[#9A1BFF] focus:ring-3 focus:ring-[#9A1BFF]/15"
          type="search"
          placeholder="이름 또는 전화번호로 검색..."
        />
      </label>

      <div class="mb-6 mt-9 flex items-center justify-between gap-4">
        <p class="m-0 text-left text-lg font-bold text-slate-600">
          총 <span class="text-[#4B0055]">{ref_customer_arr.length}명</span>의 고객
        </p>
        <button
          class="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-0 bg-[#4B0055] px-6 text-base font-extrabold text-white transition hover:bg-[#65006F] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#4B0055]/30"
          type="button"
          onclick={on_click_open_customer_create_modal}
        >
          <UserPlus size={21} strokeWidth={2.4} aria-hidden="true" />
          <span>신규 등록</span>
        </button>
      </div>

      <div class="grid gap-5">
        {#each ref_customer_arr as customer_obj (customer_obj.id)}
          <a
            use:link
            class="block rounded-2xl outline-none transition hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-[#9A1BFF]/20"
            href={PATH.userDetail(customer_obj.id)}
            aria-label={`${customer_obj.name} 고객 상세로 이동`}
          >
            <article
              class="grid min-h-[126px] grid-cols-[1fr_auto] items-center rounded-2xl border border-[#ECE6EF] bg-white px-7 py-6 text-left shadow-sm shadow-slate-200/50 transition hover:border-[#DCC9E2] hover:shadow-md hover:shadow-slate-200/70"
            >
              <div class="flex min-w-0 items-center gap-6">
                <div
                  class="grid h-16 w-16 flex-none place-items-center rounded-full bg-[#F5EAF7] text-2xl font-extrabold text-[#4B0055]"
                >
                  {get_initial(customer_obj.name)}
                </div>

                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-3">
                    <h2 class="m-0 text-2xl font-extrabold text-zinc-950">{customer_obj.name}</h2>
                    {#if customer_obj.status}
                      <span
                        class="rounded-full bg-[#4B0055] px-3.5 py-1.5 text-sm font-extrabold text-white"
                      >
                        {customer_obj.status}
                      </span>
                    {/if}
                  </div>

                  <div
                    class="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-lg font-semibold text-slate-500"
                  >
                    <span class="inline-flex items-center gap-1">
                      <Phone size={18} strokeWidth={2.2} aria-hidden="true" />
                      {customer_obj.phone}
                    </span>
                    <span class="inline-flex items-center gap-1">
                      <CalendarDays size={18} strokeWidth={2.2} aria-hidden="true" />
                      최근 방문: {customer_obj.last_visit_dt}
                    </span>
                  </div>
                </div>
              </div>

              <div class="grid min-h-[74px] min-w-24 place-items-center rounded-lg bg-[#F6F7FA] px-5">
                <p class="m-0 text-base font-bold text-slate-500">총 방문</p>
                <p class="m-0 text-3xl font-extrabold text-zinc-950">{customer_obj.visit_count}회</p>
              </div>
            </article>
          </a>
        {/each}
      </div>
    </div>
  </section>

  <CustomerCreateModal
    open={ref_customer_create_modal_open}
    onclose={on_click_close_customer_create_modal}
    oncreate={on_create_customer}
  />
</DashboardShell>
