<script>
  import {
    FACE_SHAPE_LABELS_KO,
    FACE_SHAPE_LABELS_EN,
    FACE_SHAPE_DESCRIPTIONS_KO,
  } from '@/lib/mediapipe/face_types.js'

  /**
   * @typedef {import('@/lib/stores/capture_session.svelte.js').FaceShapeResult} FaceShapeResult
   */

  /** @type {{ result?: FaceShapeResult | null }} */
  let { result = null } = $props()
</script>

{#if result}
  {@const shape = result.face_shape}
  <section
    class="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/40"
    aria-label="얼굴형 분석 결과"
  >
    <div class="text-xs font-bold uppercase tracking-wider text-slate-500">얼굴형 분석</div>
    <div class="flex items-baseline gap-2">
      <span class="text-2xl font-extrabold text-zinc-950">
        {FACE_SHAPE_LABELS_KO[shape]}
      </span>
      <span class="text-sm font-semibold text-slate-500">
        {FACE_SHAPE_LABELS_EN[shape]}
      </span>
    </div>
    <p class="m-0 text-sm leading-relaxed text-slate-700">
      {FACE_SHAPE_DESCRIPTIONS_KO[shape]}
    </p>
  </section>
{:else}
  <section
    class="flex flex-col gap-1 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4"
    aria-label="얼굴형 분석 실패"
    role="status"
  >
    <div class="text-sm font-extrabold text-amber-900">얼굴형 분석 실패</div>
    <p class="m-0 text-xs font-semibold text-amber-800">
      정면샷에서 얼굴 측정값을 얻지 못했어요. 정면을 다시 촬영해 주세요.
    </p>
  </section>
{/if}
