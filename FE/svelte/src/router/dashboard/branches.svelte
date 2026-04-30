<script>
  import { Mail, MapPin, Phone } from 'lucide-svelte'
  import DashboardShell from '@/components/layout/dashboard_shell.svelte'

  const branch_arr = [
    {
      id: 1,
      name: '강남점',
      manager_nm: '박매니저',
      address: '서울시 강남구 테헤란로 123',
      phone: '02-1234-5678',
      email: 'gangnam@retinafit.com',
    },
    {
      id: 2,
      name: '홍대점',
      manager_nm: '김매니저',
      address: '서울시 마포구 홍익로 456',
      phone: '02-2345-6789',
      email: 'hongdae@retinafit.com',
    },
  ]
</script>

<DashboardShell active_key="branches" title="지점 관리">
  <section class="px-8 py-11">
    <div class="mx-auto grid max-w-[894px] grid-cols-2 gap-6">
      {#each branch_arr as branch_obj (branch_obj.id)}
        <article
          class="min-h-[192px] rounded-xl border border-slate-200 bg-white px-6 py-6 text-left shadow-sm shadow-slate-200/40"
        >
          <div class="flex items-start gap-4">
            <div
              class="grid h-14 w-14 flex-none place-items-center rounded-xl bg-[#F5EAF7] text-[#4B0055]"
            >
              <MapPin size={29} strokeWidth={2.4} aria-hidden="true" />
            </div>

            <div class="min-w-0">
              <h2 class="m-0 text-2xl font-extrabold text-zinc-950">{branch_obj.name}</h2>
              <p class="m-0 mt-1 text-base font-bold text-slate-500">
                매니저: {branch_obj.manager_nm}
              </p>
            </div>
          </div>

          <dl class="mt-5 grid gap-3 text-base font-semibold text-slate-500">
            <div class="flex min-w-0 items-center gap-2">
              <MapPin
                class="flex-none text-slate-400"
                size={18}
                strokeWidth={2.2}
                aria-hidden="true"
              />
              <dd class="m-0 truncate">{branch_obj.address}</dd>
            </div>
            <div class="flex min-w-0 items-center gap-2">
              <Phone
                class="flex-none text-slate-400"
                size={18}
                strokeWidth={2.2}
                aria-hidden="true"
              />
              <dd class="m-0 truncate">{branch_obj.phone}</dd>
            </div>
            <div class="flex min-w-0 items-center gap-2">
              <Mail
                class="flex-none text-slate-400"
                size={18}
                strokeWidth={2.2}
                aria-hidden="true"
              />
              <dd class="m-0 truncate">{branch_obj.email}</dd>
            </div>
          </dl>
        </article>
      {/each}
    </div>
  </section>
</DashboardShell>
