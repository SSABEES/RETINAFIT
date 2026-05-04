<script>
  import { fade, fly } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import { X, RotateCcw } from 'lucide-svelte'

  /** @type {{
   *   open?: boolean,
   *   loading?: boolean,
   *   total_count?: number,
   *   result_count?: number,
   *   active_count?: number,
   *   filter_obj?: { frame_type_arr: string[], material_arr: string[], category_arr: string[] },
   *   onclose?: () => void,
   *   ontoggle?: (field: string, value: string) => void,
   *   onreset?: () => void,
   * }} */
  let {
    open = false,
    loading = false,
    total_count = 0,
    result_count = 0,
    active_count = 0,
    filter_obj = { frame_type_arr: [], material_arr: [], category_arr: [] },
    onclose = () => {},
    ontoggle = () => {},
    onreset = () => {},
  } = $props()

  const FRAME_TYPE_OPTIONS = ['풀프레임', '하프프레임', '무프레임']
  const MATERIAL_OPTIONS = ['아세테이트', '메탈', '티타늄', '혼합']
  const CATEGORY_OPTIONS = ['안경', '선글라스', '스포츠']
</script>

{#if open}
  <div
    class="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
    role="presentation"
    onclick={onclose}
    in:fade={{ duration: 200 }}
    out:fade={{ duration: 150 }}
  ></div>

  <div
    class="fixed right-0 top-0 z-50 flex h-full w-[440px] flex-col bg-white shadow-2xl"
    in:fly={{ x: 440, duration: 320, easing: cubicOut }}
    out:fly={{ x: 440, duration: 220, easing: cubicOut }}
  >
    <div class="flex shrink-0 items-center justify-between border-b border-slate-100 px-8 py-6">
      <div>
        <h3 class="text-lg font-black text-zinc-900">프레임 필터</h3>
        {#if loading}
          <p class="mt-0.5 text-xs text-slate-400">안경 목록 불러오는 중...</p>
        {:else}
          <p class="mt-0.5 text-xs text-slate-400">전체 {total_count}개</p>
        {/if}
      </div>
      <button
        type="button"
        onclick={onclose}
        class="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <X size={20} />
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      {#if loading}
        <div class="flex justify-center py-20">
          <span
            class="h-6 w-6 animate-spin rounded-full border-2 border-[var(--retina-primary-200)] border-t-transparent"
          ></span>
        </div>
      {:else}
        <div class="space-y-8 px-8 py-6">
          <div>
            <p class="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">테 종류</p>
            <div class="flex flex-wrap gap-2">
              {#each FRAME_TYPE_OPTIONS as opt (opt)}
                {@const selected = filter_obj.frame_type_arr.includes(opt)}
                <button
                  type="button"
                  onclick={() => ontoggle('frame_type_arr', opt)}
                  class={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                    selected
                      ? 'bg-[var(--retina-primary-300)] text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {opt}
                </button>
              {/each}
            </div>
          </div>

          <div>
            <p class="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">재질</p>
            <div class="flex flex-wrap gap-2">
              {#each MATERIAL_OPTIONS as opt (opt)}
                {@const selected = filter_obj.material_arr.includes(opt)}
                <button
                  type="button"
                  onclick={() => ontoggle('material_arr', opt)}
                  class={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                    selected
                      ? 'bg-[var(--retina-primary-300)] text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {opt}
                </button>
              {/each}
            </div>
          </div>

          <div>
            <p class="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">카테고리</p>
            <div class="flex flex-wrap gap-2">
              {#each CATEGORY_OPTIONS as opt (opt)}
                {@const selected = filter_obj.category_arr.includes(opt)}
                <button
                  type="button"
                  onclick={() => ontoggle('category_arr', opt)}
                  class={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                    selected
                      ? 'bg-[var(--retina-primary-300)] text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {opt}
                </button>
              {/each}
            </div>
          </div>
        </div>
      {/if}
    </div>

    <div class="shrink-0 border-t border-slate-100 bg-slate-50 px-8 py-6">
      <p class="mb-4 text-sm font-bold text-slate-500">
        {#if active_count > 0}
          <span class="text-[var(--retina-primary-300)]">{result_count}개</span>의 안경이 검색됩니다
        {:else}
          필터를 선택하면 실시간으로 결과가 반영됩니다
        {/if}
      </p>
      <div class="flex gap-3">
        <button
          type="button"
          onclick={onreset}
          disabled={active_count === 0}
          class="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 py-3.5 text-sm font-bold text-slate-500 transition-all hover:border-slate-300 hover:bg-white disabled:opacity-40"
        >
          <RotateCcw size={14} />
          초기화
        </button>
        <button
          type="button"
          onclick={onclose}
          class="flex flex-[2] items-center justify-center rounded-2xl bg-[var(--retina-primary-300)] py-3.5 text-sm font-black text-white transition-colors hover:bg-[var(--retina-primary-400)]"
        >
          적용하기
        </button>
      </div>
    </div>
  </div>
{/if}
