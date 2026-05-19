<script>
  import { onDestroy, onMount, untrack } from 'svelte'
  import { fly } from 'svelte/transition'
  import { navigate } from '@maks11060/svelte5-router'
  import { Camera as CameraIcon, X, Loader2, CheckCheck, Glasses } from 'lucide-svelte'
  import { PATH } from '@/config/path'
  import AnalysisPageLayout from '@/components/layout/analysis_page_layout.svelte'
  import LoadingOverlay from '@/components/loading/loading_overlay.svelte'
  import CameraView from '@/components/camera/camera_view.svelte'
  import { flip_blob_horizontally } from '@/lib/capture/capture_utils.js'
  import { request_real_wearing_presigned_urls, upload_blob_to_s3 } from '@/lib/api/analysis.js'
  import { get_visit, update_visit } from '@/lib/api/visit.js'
  // CameraView 가 마지막 캡처 시점에 face_recognition_complete 음성을 재생하는데,
  // voice_guide 가 모듈 싱글톤이라 사용자가 음성 종료 전에 result 로 navigate 하면
  // 다음 화면 위에서 그 음성이 계속 재생된다. 언마운트 시점에 명시적으로 stop.
  import {
    silence as silence_voice,
    unsilence as unsilence_voice,
    play as play_voice,
    wait_for_active as wait_for_voice,
  } from '@/lib/audio/voice_guide.js'

  // result.svelte 가 첫 mount 에 즉시 화면을 채우도록 prefetch 한 visit_obj 를 잠시 보관할 sessionStorage 키.
  const PREFETCH_VISIT_KEY = 'retinal_prefetched_visit_obj'
  import { push_error_toast } from '@/lib/stores/toast'
  import { start_oh_capture_gate } from '@/lib/measurements/oh_capture_gate.js'
  import { save_real_wearing_oh } from '@/lib/utils/real_wearing_oh_storage.js'

  const ANALYSIS_TOAST_DURATION_MS = 5000

  /**
   * @typedef {{ x: number, y: number }} Point2D
   * @typedef {{ pupil: Point2D, rim_bottom: Point2D }} OhMeasurePoints
   * @typedef {{
   *   blob: Blob,
   *   object_url: string,
   *   captured_at: number,
   *   oh_left_mm?: number,
   *   oh_right_mm?: number,
   *   oh_source?: 'aruco' | 'pd_fallback',
   *   oh_points_left?: OhMeasurePoints,
   *   oh_points_right?: OhMeasurePoints,
   * }} CaptureSlot
   * @typedef {{ id: number, slot_arr: (CaptureSlot | null)[], captured_at: number }} SavedSet
   */

  // 한 번 분석 세션에서 저장 가능한 최대 세트 수.
  const MAX_PHOTO_SET_COUNT = 5
  const SLOT_LABEL_ARR = ['정면', '좌측', '우측']
  const SLOT_ICON_ARR = ['/icons/face_center.png', '/icons/face_left.png', '/icons/face_right.png']
  // 슬롯 인덱스 → CameraView pose_target 매핑. analysis/index.svelte 의 step 정책과 동일하게
  // 정면 → 좌측 → 우측 순서.
  /** @type {('front'|'left_profile'|'right_profile')[]} */
  const POSE_BY_SLOT = ['front', 'left_profile', 'right_profile']
  // 토스트 노출 시간.
  const TOAST_VISIBLE_MS = 1800

  /** @type {{ trigger_capture: () => Promise<boolean>, reset: () => void } | null} */
  let ref_this_camera = $state(null)

  /** @type {(CaptureSlot | null)[]} */
  let g_capture_slot_arr = $state([null, null, null])
  /** @type {SavedSet[]} */
  let g_saved_set_arr = $state([])
  let g_set_id_seq = 0

  let g_toast_message = $state(/** @type {string | null} */ (null))

  // 최종 리포트 보기 클릭 시 업로드/PATCH 진행 상태.
  let g_is_submitting = $state(false)

  // 다음 빈 슬롯 인덱스 (0~2). 모두 채워졌으면 3 — 한 세트 완성, 자동 모드 정지.
  const g_next_slot_idx = $derived.by(() => {
    const local_idx = g_capture_slot_arr.findIndex((s) => s === null)
    return local_idx === -1 ? 3 : local_idx
  })
  /** @type {('front'|'left_profile'|'right_profile') | null} */
  const g_current_pose = $derived(g_next_slot_idx < 3 ? POSE_BY_SLOT[g_next_slot_idx] : null)
  const g_is_set_complete = $derived(g_next_slot_idx >= 3)

  // 정면 슬롯 OH 게이트 보관소 — on_pass 시점에 set, on_capture 가 슬롯에 첨부 후 reset.
  /** @type {{ oh_left_mm: number, oh_right_mm: number, oh_source: 'aruco' | 'pd_fallback', oh_points_left: OhMeasurePoints, oh_points_right: OhMeasurePoints } | null} */
  let g_pending_oh = $state(null)

  // 게이트 진행 상태 메시지 — 화면 상단에 표시.
  let g_oh_gate_hint = $state('')

  // OH 게이트가 매 측정 사이클마다 발사하는 ROI + 림 위치 — CameraView 가 캔버스에 수평선으로 그림.
  /** @type {import('@/lib/measurements/oh_capture_gate.js').OhOverlayState | null} */
  let g_oh_overlay = $state(null)

  // 정면 슬롯은 OH 게이트 통과 후 수동 trigger. 좌/우는 기존 자세 안정성 게이트로 auto 캡처.
  const g_capture_mode = $derived(g_current_pose === 'front' ? 'manual' : 'auto')

  // 1장 이상 촬영했으면 세트 저장 가능 (arfitting 정책과 동일).
  let g_has_any_capture = $derived(g_capture_slot_arr.some((s) => s !== null))
  let g_is_set_limit_reached = $derived(g_saved_set_arr.length >= MAX_PHOTO_SET_COUNT)
  let g_can_save = $derived(g_has_any_capture && !g_is_set_limit_reached)

  // result 에서 뒤로가기로 다시 들어왔을 때, 이전에 silence_voice() 해둔 봉인을 해제해야 CameraView 음성이 정상 재생된다.
  onMount(() => {
    unsilence_voice()
  })

  onDestroy(() => {
    // 진행 중이던 CameraView 음성을 차단 — result 화면에서 이전 페이지 음성이 이어 들리는 현상 방지.
    silence_voice()
    for (const local_slot of g_capture_slot_arr) {
      if (local_slot?.object_url) URL.revokeObjectURL(local_slot.object_url)
    }
    for (const local_set of g_saved_set_arr) {
      for (const local_slot of local_set.slot_arr) {
        if (local_slot?.object_url) URL.revokeObjectURL(local_slot.object_url)
      }
    }
  })

  // pose 가 바뀌면 (=다음 빈 슬롯이 바뀌면) CameraView 재무장. 한 세트 완성(g_current_pose=null)
  // 이후엔 capture_mode='manual' 로 자동 발사 정지하므로 reset 호출은 분기에서 자연스럽게 스킵.
  $effect(() => {
    const _pose = g_current_pose
    if (_pose && ref_this_camera) {
      ref_this_camera.reset()
    }
  })

  /** @type {{ handle_landmarks: (d: any) => void, stop: () => void } | null} */
  let g_oh_gate = $state(null)

  // 정면 슬롯 진입 시 OH 게이트 활성, 빠질 때 정리. 슬롯 전환 시 마다 fresh gate.
  $effect(() => {
    const _pose = g_current_pose
    if (_pose === 'front') {
      g_pending_oh = null
      g_oh_overlay = null
      g_oh_gate_hint = '정면을 바라봐 주세요'
      g_oh_gate = start_oh_capture_gate({
        on_pass: (result) => {
          g_pending_oh = result
          g_oh_gate_hint = '측정 완료'
          if (ref_this_camera) {
            void ref_this_camera.trigger_capture()
          }
        },
        on_status: (status) => {
          g_oh_gate_hint = status.hint
        },
        on_overlay_update: (overlay) => {
          g_oh_overlay = overlay
        },
      })
    } else if (g_oh_gate) {
      // pose 가 front 가 아닐 때 게이트 정리. untrack 으로 cleanup 의 재진입 방지.
      const local_gate_to_stop = g_oh_gate
      untrack(() => {
        local_gate_to_stop.stop()
        g_oh_gate = null
      })
      g_oh_gate_hint = ''
    }
    return () => {
      // cleanup 시 g_oh_gate 변경이 effect 재진입 일으키지 않도록 untrack
      untrack(() => {
        if (g_oh_gate) {
          g_oh_gate.stop()
          g_oh_gate = null
        }
      })
    }
  })

  /**
   * CameraView 가 자동 캡처를 마치면 raw blob 을 좌우반전해서 슬롯에 저장.
   * unmirrored 분석은 CameraView 내부에서 끝났고, 슬롯/업로드용 사진은 사용자가 보던 미러 프리뷰
   * 시각과 일치해야 하므로 mirror 변환. 슬롯 갱신 → g_next_slot_idx 자동 전진 → effect 재무장.
   * @param {{ blob: Blob, object_url: string, captured_at: number }} result
   */
  async function on_capture(result) {
    const local_idx = g_next_slot_idx
    if (local_idx >= 3) return

    let local_blob = result.blob
    let local_url = result.object_url
    try {
      const local_mirrored = await flip_blob_horizontally(result.blob)
      URL.revokeObjectURL(result.object_url)
      local_blob = local_mirrored
      local_url = URL.createObjectURL(local_mirrored)
    } catch {
      // mirror 실패 시 raw 그대로 사용 (UX 막지 않음).
    }

    const local_next_arr = [...g_capture_slot_arr]
    local_next_arr[local_idx] = {
      blob: local_blob,
      object_url: local_url,
      captured_at: result.captured_at,
    }
    if (g_pending_oh) {
      local_next_arr[local_idx].oh_left_mm = g_pending_oh.oh_left_mm
      local_next_arr[local_idx].oh_right_mm = g_pending_oh.oh_right_mm
      local_next_arr[local_idx].oh_source = g_pending_oh.oh_source
      local_next_arr[local_idx].oh_points_left = g_pending_oh.oh_points_left
      local_next_arr[local_idx].oh_points_right = g_pending_oh.oh_points_right
      g_pending_oh = null
    }

    // 인식 완료 안내 음성 — index.svelte 의 얼굴 측정 on_capture 와 동일 패턴.
    // 진행 중인 셔터음(camera_shutter_sound, 동일 high priority)이 끝나길 wait_for_voice 로 먼저 기다린 뒤 재생.
    // 슬롯 커밋 직전에 await: 슬롯이 채워지면 g_current_pose 가 바뀌며 CameraView.reset() → stop_voice()
    // 가 호출되므로, 안내가 끝까지 들리도록 여기서 끝까지 재생한 뒤 슬롯을 전진시킨다.
    const local_pose_type = POSE_BY_SLOT[local_idx]
    const local_complete_key =
      local_pose_type === 'front'
        ? 'front_side_capture_complete'
        : local_pose_type === 'left_profile'
          ? 'left_side_capture_complete'
          : 'right_side_capture_complete'
    await wait_for_voice()
    await play_voice(local_complete_key, { priority: 'high' })

    g_capture_slot_arr = local_next_arr
  }

  // CameraView 가 toBlob 실패 등으로 에러를 던지면 호출됨. 사용자 토스트로 노출하고 자동 재무장.
  function on_capture_error() {
    show_toast('촬영에 실패했어요')
    if (ref_this_camera) ref_this_camera.reset()
  }

  /** @param {string} message */
  function show_toast(message) {
    g_toast_message = message
    setTimeout(() => {
      if (g_toast_message === message) g_toast_message = null
    }, TOAST_VISIBLE_MS)
  }

  // 슬롯 비우기 — 자동 모드가 비어진 슬롯을 다시 채우러 발사.
  /** @param {number} idx */
  function on_click_reset_slot(idx) {
    if (g_is_submitting) return
    const local_prev = g_capture_slot_arr[idx]
    if (local_prev?.object_url) URL.revokeObjectURL(local_prev.object_url)
    const local_next_arr = [...g_capture_slot_arr]
    local_next_arr[idx] = null
    g_capture_slot_arr = local_next_arr
  }

  // 현재 3슬롯을 한 세트로 저장 (최신이 위로 prepend). 슬롯 초기화.
  function on_click_save_set() {
    if (!g_can_save || g_is_submitting) return
    g_set_id_seq += 1
    g_saved_set_arr = [
      {
        id: g_set_id_seq,
        slot_arr: [...g_capture_slot_arr],
        captured_at: Date.now(),
      },
      ...g_saved_set_arr,
    ]
    g_capture_slot_arr = [null, null, null]
    // CameraView 의 active prop 이 !g_is_set_complete 에 연결되어 있어 슬롯이 비워지면 자동 재시작.
    // (3장 완료 시점에 active=false 로 카메라가 정지된 상태였고, 슬롯 비움 → active=true → 새 세션)

    // OH 미러 갱신 (visit_no 매치 시 result 페이지가 읽음)
    void sync_oh_storage()
  }

  // 누적 SavedSet 의 정면 슬롯 OH 값을 storage 에 미러링.
  async function sync_oh_storage() {
    try {
      const local_visit_no = get_visit_no()
      if (!Number.isFinite(local_visit_no) || local_visit_no === null) return
      const sets = g_saved_set_arr
        .map((set) => {
          const front_slot = set.slot_arr[0]
          if (!front_slot || !Number.isFinite(front_slot.oh_left_mm)) return null
          return {
            set_id: set.id,
            oh_left_mm: /** @type {number} */ (front_slot.oh_left_mm),
            oh_right_mm: /** @type {number} */ (front_slot.oh_right_mm),
            oh_source: front_slot.oh_source ?? 'pd_fallback',
            oh_points_left: front_slot.oh_points_left,
            oh_points_right: front_slot.oh_points_right,
          }
        })
        .filter((s) => s !== null)
      // save_real_wearing_oh 는 동기 (sessionStorage.setItem) — await 불필요.
      save_real_wearing_oh({ visit_id: local_visit_no, sets })
    } catch (err) {
      console.warn('[real_fitting] OH storage 미러링 실패:', err)
    }
  }

  // 저장된 세트 개별 제거.
  /** @param {number} id */
  function on_click_remove_saved(id) {
    if (g_is_submitting) return
    const local_target = g_saved_set_arr.find((local_set) => local_set.id === id)
    if (local_target) {
      for (const local_slot of local_target.slot_arr) {
        if (local_slot?.object_url) URL.revokeObjectURL(local_slot.object_url)
      }
    }
    g_saved_set_arr = g_saved_set_arr.filter((local_set) => local_set.id !== id)
  }

  // 현재 탭 세션의 visit_no 를 읽어 PATCH 대상을 결정. lens_consult.svelte 와 동일 규칙.
  function get_visit_no() {
    if (typeof sessionStorage === 'undefined') return null
    const local_raw = sessionStorage.getItem('retinal_visit_no')
    if (local_raw) {
      const local_num = Number(local_raw)
      if (Number.isFinite(local_num)) return local_num
    }
    const local_selected_json = sessionStorage.getItem('retinal_selected_visit_obj')
    if (!local_selected_json) return null
    try {
      const local_selected = JSON.parse(local_selected_json)
      const local_num = Number(local_selected?.visit_no)
      return Number.isFinite(local_num) ? local_num : null
    } catch {
      return null
    }
  }

  // 뒤로가기 — 브라우저 히스토리를 한 칸 pop 한다.
  // navigate(arfitting) 로 새 엔트리를 push 하면, arfitting 의 기본 뒤로가기(history.back)와
  // 맞물려 arfitting ↔ real_fitting 이 무한 반복된다. 그래서 여기선 history 를 되돌린다.
  function on_click_back() {
    if (g_is_submitting) return
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
      return
    }
    navigate(PATH.analysisArFitting)
  }

  // 최종 리포트 보기 — 세트별로 presigned 발급 → 채워진 슬롯만 S3 PUT → 모두 끝나면 visit PATCH(real_vp_json).
  // 오버레이는 다른 분석 화면(report/arfitting)과 동일한 LoadingOverlay 패턴 — 클릭 즉시 노출되도록
  // g_is_submitting 을 함수 진입 시점에 true 로 끌어올린다.
  async function on_click_continue() {
    if (g_is_submitting) return
    g_is_submitting = true
    // 사용자가 버튼 클릭한 순간 CameraView 의 진행 중인 음성(예: face_recognition_complete) 을 즉시 차단.
    // onDestroy 만으론 navigate 까지의 async 업로드/PATCH 동안 음성이 계속 들리고, 심하면 result 화면까지 끌고 간다.
    silence_voice()

    try {
      const local_visit_no = get_visit_no()

      // 사진이 없으면 업로드 없이 바로 result 로 — 단, prefetch 만 시도해서 즉시 채워질 수 있게 한다.
      if (g_saved_set_arr.length === 0) {
        sessionStorage.removeItem('retinal_detail_return_path')
        if (local_visit_no) {
          try {
            const local_fresh_visit_obj = await get_visit({ visit_no: local_visit_no })
            sessionStorage.setItem(
              PREFETCH_VISIT_KEY,
              JSON.stringify({ visit_no: local_visit_no, visit_obj: local_fresh_visit_obj }),
            )
          } catch (prefetch_err) {
            console.warn('[real_fitting] visit prefetch failed', prefetch_err)
          }
        }
        navigate(PATH.analysisMemberSelect)
        return
      }

      if (!local_visit_no) {
        push_error_toast(
          '방문 번호를 찾을 수 없습니다. 다시 진입해 주세요.',
          ANALYSIS_TOAST_DURATION_MS,
        )
        return
      }

      /** @type {Array<{ set_no: number, front_key: string, left_key: string, right_key: string, captured_at: number }>} */
      const local_set_record_arr = []

      // 화면상 최신이 위 = 배열 앞쪽. 저장 순서는 촬영 순서(오래된 → 최신) 로 뒤집어서 반복.
      const local_chronological_arr = [...g_saved_set_arr].reverse()

      for (let i = 0; i < local_chronological_arr.length; i += 1) {
        const local_set = local_chronological_arr[i]
        const local_presigned = await request_real_wearing_presigned_urls(local_visit_no)
        const local_url_arr = [
          local_presigned.front_url,
          local_presigned.left_url,
          local_presigned.right_url,
        ]
        const local_key_arr = [
          local_presigned.front_key,
          local_presigned.left_key,
          local_presigned.right_key,
        ]

        // 채워진 슬롯만 업로드. 빈 슬롯은 빈 key 로 BE 에 전달.
        await Promise.all(
          local_set.slot_arr.map((local_slot, local_idx) =>
            local_slot ? upload_blob_to_s3(local_url_arr[local_idx], local_slot.blob) : null,
          ),
        )

        // BE 가 GET 응답 시점에 _key 를 presigned download URL 로 변환하므로 FE 는 key 만 저장.
        local_set_record_arr.push({
          set_no: i + 1,
          front_key: local_set.slot_arr[0] ? local_key_arr[0] : '',
          left_key: local_set.slot_arr[1] ? local_key_arr[1] : '',
          right_key: local_set.slot_arr[2] ? local_key_arr[2] : '',
          captured_at: local_set.captured_at,
        })
      }

      await update_visit({
        visit_no: local_visit_no,
        body: {
          real_vp_json: { sets: local_set_record_arr },
          real_vp_dt: new Date().toISOString(),
        },
      })

      sessionStorage.removeItem('retinal_detail_return_path')
      // PATCH 반영 후 visit 전체를 한 번 GET — result.svelte 진입 즉시 화면이 채워지도록 prefetch.
      // 실패해도 사용자 흐름을 막지 않음 (result.svelte 가 자체 fetch fallback 함).
      try {
        const local_fresh_visit_obj = await get_visit({ visit_no: local_visit_no })
        sessionStorage.setItem(
          PREFETCH_VISIT_KEY,
          JSON.stringify({ visit_no: local_visit_no, visit_obj: local_fresh_visit_obj }),
        )
      } catch (prefetch_err) {
        console.warn('[real_fitting] visit prefetch failed', prefetch_err)
      }

      navigate(PATH.analysisResult)
    } catch (err) {
      const local_message = err instanceof Error ? err.message : '업로드에 실패했습니다.'
      console.error('[real_fitting] submit failed', err)
      push_error_toast(local_message, ANALYSIS_TOAST_DURATION_MS)
    } finally {
      g_is_submitting = false
    }
  }
</script>

<AnalysisPageLayout current_step={3} bg_class="bg-white text-zinc-900" onback={on_click_back}>
  <div
    class="grid flex-1 grid-cols-1 grid-rows-[55svh_auto] min-h-0 md:grid-cols-[1fr_300px] md:grid-rows-1 xl:grid-cols-[1fr_360px] 2xl:grid-cols-[1fr_420px] bg-[var(--retina-text-100)]"
  >
    <!--
      좌측: 카메라 — analysis/index.svelte 와 동일한 자동 캡처 흐름(정면→좌→우 자동 진행).
      모바일에선 위쪽 row(55svh), md+ 에서 좌측 flex column.
    -->
    <section class="relative flex min-h-0 flex-1 flex-col">
      <div class="relative min-h-0 flex-1 overflow-hidden bg-zinc-950 shadow-inner">
        <!--
          3장 모두 채워지면 카메라 자체를 비활성화 (스트림/추론 모두 정지).
          사용자가 [세트 저장] 또는 슬롯 X 버튼으로 슬롯이 비워지면 g_is_set_complete=false 가 되어
          CameraView 가 자동으로 재시작되며 첫 빈 슬롯부터 자동 캡처가 다시 무장된다.
        -->
        <CameraView
          bind:this={ref_this_camera}
          active={!g_is_submitting && !g_is_set_complete}
          pose_target={g_current_pose ?? 'front'}
          capture_mode={g_capture_mode}
          oncapture={on_capture}
          oncapture_error={on_capture_error}
          onlandmarks={g_oh_gate?.handle_landmarks ?? undefined}
          oh_overlay={g_oh_overlay}
          simple_guide_color={true}
        />

        {#if g_current_pose === 'front' && g_oh_gate_hint && !g_pending_oh}
          <div class="absolute top-4 left-1/2 -translate-x-1/2 z-20 rounded-full bg-black/70 text-white text-sm px-4 py-2">
            {g_oh_gate_hint}
          </div>
        {/if}

        {#if g_is_set_complete}
          <!-- 3장 모두 채워지면 자동 모드 정지. 사용자가 [세트 저장] 또는 슬롯 X 로 분기. -->
          <div
            class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/50 px-6 text-center backdrop-blur-sm"
          >
            <div class="rounded-xl border border-white/10 bg-zinc-900/85 px-6 py-4 shadow-xl">
              <p class="text-[18px] font-extrabold text-white">3장 모두 촬영 완료</p>
              <p class="mt-2 text-[13px] font-semibold leading-relaxed text-white/75">
                [세트 저장]으로 보관 후 다른 안경 추가촬영 진행하거나 <br /> 촬영 기록의 슬롯 X 버튼으로
                해당 각도 재촬영 할 수 있어요.
              </p>
            </div>
          </div>
        {/if}
      </div>
    </section>

    <!-- 우측: 캡쳐 슬롯 + 안내 + 저장 액션 — 모바일에선 하단 stack(콘텐츠 크기) -->
    <aside
      class="relative flex flex-col border-t md:border-t-0 md:border-l border-slate-200 bg-white"
    >
      <!-- 캡쳐 슬롯 -->
      <div class="px-[clamp(8px,2svh,16px)] pt-[clamp(6px,1.5svh,12px)] pb-[clamp(4px,1svh,8px)]">
        <div class="mb-[clamp(4px,1svh,8px)] flex items-center justify-between">
          <h2 class="font-extrabold tracking-wide text-[#374151] text-[clamp(9px,1.4svh,12px)]">
            촬영 기록
          </h2>
        </div>
        <div class="grid grid-cols-3 gap-[clamp(4px,1svh,8px)] pr-1">
          {#each g_capture_slot_arr as slot, idx (idx)}
            {@const is_current = !slot && g_next_slot_idx === idx && !g_is_submitting}
            <div class="group relative flex flex-col items-center gap-1">
              <div
                aria-label={`${SLOT_LABEL_ARR[idx]} 슬롯`}
                aria-current={is_current ? 'step' : undefined}
                class={`relative flex aspect-[3/4] w-full items-center justify-center rounded-none border p-0 transition-all ${
                  slot
                    ? 'border-[var(--retina-primary-300)] bg-[var(--retina-bg-1)]'
                    : is_current
                      ? 'border-[var(--retina-primary-300)] bg-white ring-2 ring-[var(--retina-primary-300)]/30'
                      : 'border-[#F1F3F5] bg-[#F1F3F5]'
                }`}
              >
                {#if slot}
                  <img
                    src={slot.object_url}
                    alt={SLOT_LABEL_ARR[idx]}
                    class="h-full w-full object-cover"
                  />
                {:else}
                  <img
                    src={SLOT_ICON_ARR[idx]}
                    alt={`${SLOT_LABEL_ARR[idx]} 안내`}
                    class="object-contain opacity-70 h-[clamp(14px,2.5svh,22px)] w-[clamp(14px,2.5svh,22px)]"
                  />
                {/if}
                {#if is_current}
                  <span class="absolute -top-1 -right-1 flex h-2.5 w-2.5" aria-hidden="true">
                    <span
                      class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--retina-primary-300)] opacity-75"
                    ></span>
                    <span
                      class="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--retina-primary-300)]"
                    ></span>
                  </span>
                {/if}
              </div>
              {#if slot}
                <button
                  type="button"
                  onclick={() => on_click_reset_slot(idx)}
                  aria-label="다시 촬영"
                  class="absolute -right-1.5 top-[-6px] flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border-0 bg-white text-slate-400 shadow-md hover:text-red-500"
                >
                  <X size={11} />
                </button>
              {/if}
              <span
                class={`font-bold text-[clamp(9px,1.4svh,12px)] ${
                  slot
                    ? 'text-[var(--retina-primary-300)]'
                    : is_current
                      ? 'text-[var(--retina-primary-300)]'
                      : 'text-slate-400'
                }`}
              >
                {SLOT_LABEL_ARR[idx]}
              </span>
            </div>
          {/each}
        </div>
      </div>

      <hr class="mx-4 my-1 border-slate-200" />

      <!-- 안내 영역 (arfitting 의 추천 안경 자리) -->
      <div
        class="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-[clamp(8px,2svh,16px)] py-[clamp(8px,2svh,16px)]"
      >
        <h2
          class="mb-[clamp(4px,1svh,8px)] font-extrabold text-zinc-900 text-[clamp(11px,1.8svh,14px)]"
        >
          실제 착용 촬영
        </h2>
        <div
          class="rounded-lg bg-[var(--retina-text-100)] font-medium leading-relaxed text-slate-600 px-[clamp(8px,1.8svh,14px)] py-[clamp(8px,1.8svh,14px)] text-[clamp(10px,1.7svh,13px)]"
        >
          가이드에 맞춰 자세를 잡으면 정면 → 좌측 → 우측 순으로 자동 촬영됩니다.<br />
          1장 이상 촬영되면 [세트 저장] 버튼이 활성화됩니다.<br />
          여러 안경을 비교하려면 세트를 추가로 저장하세요.
        </div>
        <div
          class="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-slate-200 font-semibold text-slate-500 px-[clamp(8px,1.8svh,14px)] py-[clamp(4px,1svh,8px)] text-[clamp(9px,1.5svh,12px)]"
        >
          <Glasses size={14} class="shrink-0 text-slate-400" />
          최대 {MAX_PHOTO_SET_COUNT} 세트까지 저장 가능
        </div>
      </div>

      <!-- 저장된 세트 + 액션 버튼 -->
      <div
        class="border-t border-slate-100 bg-white px-[clamp(8px,2svh,16px)] py-[clamp(6px,1.5svh,14px)]"
      >
        {#if g_saved_set_arr.length > 0}
          <div class="mb-2">
            <div class="mb-1 flex items-center justify-between">
              <span class="text-[10px] font-extrabold tracking-wide text-slate-500">
                저장된 세트 ({g_saved_set_arr.length}/{MAX_PHOTO_SET_COUNT})
              </span>
              {#if g_saved_set_arr.length >= MAX_PHOTO_SET_COUNT}
                <span class="text-[10px] font-bold text-amber-500">최대</span>
              {/if}
            </div>
            <div class="custom-scrollbar flex gap-1 overflow-x-auto pb-0.5">
              {#each g_saved_set_arr as set, idx (set.id)}
                <div
                  class="flex shrink-0 items-center gap-1 rounded-lg bg-[var(--retina-bg-1)] px-2 py-1"
                  in:fly={{ y: 6, duration: 200 }}
                >
                  <CheckCheck size={9} class="shrink-0 text-[var(--retina-primary-300)]" />
                  <span
                    class="max-w-[60px] truncate text-[10px] font-bold text-[var(--retina-primary-300)]"
                  >
                    세트 {g_saved_set_arr.length - idx}
                  </span>
                  <button
                    type="button"
                    onclick={() => on_click_remove_saved(set.id)}
                    aria-label="세트 제거"
                    class="ml-0.5 shrink-0 cursor-pointer border-0 bg-transparent p-0 text-slate-400 transition-colors hover:text-red-400"
                  >
                    <X size={9} />
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <p class="mb-1.5 text-center text-[10px] font-semibold text-slate-500">
          1장 이상 촬영하면 세트를 저장할 수 있어요.
        </p>

        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!g_can_save || g_is_submitting}
            onclick={on_click_save_set}
            aria-label="세트 저장"
            class="flex aspect-[31/13] w-full cursor-pointer items-center justify-center gap-1 rounded-lg border-2 border-[var(--retina-primary-300)] bg-white px-2 font-extrabold text-[var(--retina-primary-300)] transition-all hover:bg-[var(--retina-bg-1)] disabled:cursor-not-allowed disabled:opacity-30 disabled:grayscale text-[clamp(13px,2.4svh,22px)]"
          >
            <CameraIcon
              strokeWidth={2.5}
              aria-hidden="true"
              class="h-[clamp(16px,2.8svh,26px)] w-[clamp(16px,2.8svh,26px)]"
            />
            세트 저장
          </button>

          <button
            type="button"
            disabled={g_is_submitting}
            onclick={on_click_continue}
            aria-label="최종 리포트 보기"
            class="flex aspect-[31/13] w-full cursor-pointer items-center justify-center gap-1 rounded-lg border-0 bg-[var(--retina-primary-300)] px-2 font-extrabold leading-tight text-white shadow-sm transition-all hover:bg-[var(--retina-primary-400)] disabled:cursor-not-allowed disabled:opacity-30 disabled:grayscale text-[clamp(13px,2.4svh,22px)]"
          >
            {#if g_is_submitting}
              <Loader2 size={12} strokeWidth={2.4} class="animate-spin" aria-hidden="true" />
              업로드 중
            {:else}
              최종 리포트 보기
            {/if}
          </button>
        </div>
      </div>
    </aside>

    {#if g_toast_message}
      <div
        class="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-red-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg"
        role="status"
        aria-live="polite"
      >
        {g_toast_message}
      </div>
    {/if}
  </div>

  <LoadingOverlay open={g_is_submitting} label="리포트를 준비하고 있어요..." />
</AnalysisPageLayout>

<style>
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #e2e8f0;
    border-radius: 10px;
  }
</style>
