<script>
  import { onMount } from 'svelte'
  import { navigate } from '@maks11060/svelte5-router'
  import { fade, fly } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import {
    Glasses,
    CheckCheck,
    X,
    HelpCircle,
    ChevronRight,
    SlidersHorizontal,
    RotateCcw,
    Save,
    FileText,
  } from 'lucide-svelte'
  import Header from '@/components/layout/header.svelte'
  import CameraView from '@/components/camera/camera_view.svelte'
  import CameraPermissionModal from '@/components/modal/camera_permission_modal.svelte'
  import { PATH } from '@/config/path'
  import {
    check_camera_permission_state,
    request_camera_permission,
    watch_camera_permission_change,
  } from '@/lib/capture/permission'
  import {
    get_all_glasses,
    request_fitting_presigned_urls,
    confirm_fitting_result,
  } from '@/lib/api/glasses'
  import {
    add_virtual_fitting_event_listener,
    check_virtual_fitting_availability,
    get_virtual_fitting_asset_path,
    get_virtual_fitting_model_url,
    is_flutter_bridge_ready,
    launch_virtual_fitting,
    wait_for_flutter_bridge,
  } from '@/lib/flutter'
  import { selected_visit_obj } from '@/lib/stores/customer'
  import { clear_login_select_data } from '@/lib/stores/admin'
  import { clear_auto_login_obj } from '@/lib/stores/auto_login'

  /**
   * @typedef {{
   *   file_obj: File,
   *   object_url: string,
   *   captured_at: number,
   * }} CaptureSlot
   */

  let g_recommended_arr = $state([])
  let g_loading = $state(true)
  let g_selected_id = $state(null)
  let g_capture_slot_arr = $state([null, null, null])
  let g_show_intro = $state(false)
  let g_is_capturing = $state(false)
  let g_flutter_bridge_ready = $state(false)
  let g_flutter_availability = $state('UNKNOWN')
  let g_flutter_event_text = $state('')
  let g_flutter_launch_loading = $state(false)
  // Native AR 호출 후 웹 카메라 스트림이 끊긴 경우 재시작 트리거
  let g_camera_active = $state(true)
  /** @type {{ trigger_capture: () => Promise<boolean>, reset: () => void } | null} */
  let ref_this_camera = $state(null)

  const SLOT_LABEL_ARR = ['정면', '좌측', '우측']
  const SLOT_ICON_ARR = [
    '/icons/face_center.png',
    '/icons/face_left.png',
    '/icons/face_right.png',
  ]
  const MAX_FITTINGS = 5

  let g_all_captured = $derived(g_capture_slot_arr.every((s) => s !== null))
  let g_next_slot_idx = $derived(g_capture_slot_arr.findIndex((s) => s === null))
  let g_camera_pose_target = $derived.by(() => {
    if (g_next_slot_idx === 1) return 'left_profile'
    if (g_next_slot_idx === 2) return 'right_profile'
    return 'front'
  })

  // { glasses_id, brand, model, captures } 형태로 최대 5개 저장
  let g_saved_fittings_arr = $state([])

  let g_can_save = $derived(g_all_captured && g_saved_fittings_arr.length < MAX_FITTINGS)
  let g_can_submit = $derived(g_saved_fittings_arr.length > 0)

  // 안경 id별 저장 횟수 맵 (목록 카드 배지 표시용)
  let g_saved_count_map = $derived(
    g_saved_fittings_arr.reduce((acc, fit) => {
      acc[fit.glasses_id] = (acc[fit.glasses_id] ?? 0) + 1
      return acc
    }, {}),
  )

  let g_toast_msg = $state('')
  let g_toast_timer = $state(null)

  /**
   * 메시지를 띄우고 2.8초 뒤 내림
   */
  function show_toast(msg) {
    g_toast_msg = msg
    clearTimeout(g_toast_timer)
    g_toast_timer = setTimeout(() => (g_toast_msg = ''), 2800)
  }

  const FRAME_TYPE_OPTIONS = ['풀프레임', '하프프레임', '무프레임']
  const MATERIAL_OPTIONS = ['아세테이트', '메탈', '티타늄', '혼합']
  const CATEGORY_OPTIONS = ['안경', '선글라스', '스포츠']

  // API 응답을 피팅 카드·필터에서 사용하는 필드 구조로 정규화
  function normalize_glasses_arr(glass_arr) {
    return (Array.isArray(glass_arr) ? glass_arr : []).map((local_glass_obj, local_index) => {
      const local_spec_obj = local_glass_obj.glasses_spec_json ?? {}
      const local_raw_no = Number(local_glass_obj.glasses_no)
      const local_safe_no = Number.isFinite(local_raw_no) ? local_raw_no : local_index + 1

      return {
        id: local_safe_no,
        glasses_no: local_safe_no,
        brand: String(local_glass_obj.glasses_brand ?? ''),
        model: String(local_glass_obj.glasses_name ?? ''),
        price: String(local_spec_obj.price ?? ''),
        frame_type: String(local_spec_obj.frame_type ?? ''),
        frame_style: String(local_spec_obj.frame_style ?? ''),
        material: String(local_spec_obj.material ?? ''),
        category: String(local_spec_obj.category ?? ''),
        img_url: String(local_glass_obj.glasses_img_url ?? ''),
        glasses_3d_url: String(local_glass_obj.glasses_3d_url ?? ''),
      }
    })
  }
  let g_filter_modal_open = $state(false)
  let g_filter_loading = $state(false)
  let g_all_glasses_arr = $state([])
  let g_filter_obj = $state({ frame_type_arr: [], material_arr: [], category_arr: [] })

  let g_active_filter_count = $derived(
    g_filter_obj.frame_type_arr.length +
      g_filter_obj.material_arr.length +
      g_filter_obj.category_arr.length,
  )

  let g_glasses_arr = $derived.by(() => {
    if (g_active_filter_count === 0 || g_all_glasses_arr.length === 0) return g_recommended_arr
    let result = [...g_all_glasses_arr]
    if (g_filter_obj.frame_type_arr.length > 0)
      result = result.filter((g) => g_filter_obj.frame_type_arr.includes(g.frame_style))
    if (g_filter_obj.material_arr.length > 0)
      result = result.filter((g) => g_filter_obj.material_arr.includes(g.material))
    if (g_filter_obj.category_arr.length > 0)
      result = result.filter((g) => g_filter_obj.category_arr.includes(g.category))
    return result
  })
  let g_selected_glasses_obj = $derived(
    g_glasses_arr.find((local_glasses_obj) => local_glasses_obj.id === g_selected_id) ?? null,
  )
  let g_selected_asset_path = $derived(
    g_selected_glasses_obj ? get_virtual_fitting_asset_path(g_selected_glasses_obj) : '',
  )
  let g_selected_model_url = $derived(
    g_selected_glasses_obj ? get_virtual_fitting_model_url(g_selected_glasses_obj) : '',
  )
  let g_can_launch_flutter_fitting = $derived(
    g_flutter_bridge_ready &&
      g_flutter_availability === 'SUPPORTED' &&
      Boolean(g_selected_glasses_obj) &&
      (Boolean(g_selected_asset_path) || Boolean(g_selected_model_url)) &&
      !g_flutter_launch_loading,
  )

  onMount(() => {
    g_show_intro = true
    setTimeout(() => (g_show_intro = false), 3200)

    g_flutter_bridge_ready = is_flutter_bridge_ready()

    void wait_for_flutter_bridge().then((local_bridge_ready) => {
      g_flutter_bridge_ready = local_bridge_ready

      if (!local_bridge_ready) {
        return
      }

      check_virtual_fitting_availability()
        .then((local_status_text) => {
          g_flutter_availability = local_status_text
        })
        .catch(() => {
          g_flutter_availability = 'UNKNOWN'
        })
    })

    const local_remove_flutter_listener = add_virtual_fitting_event_listener((local_event_obj) => {
      const local_event_name = String(local_event_obj?.event ?? 'unknown')
      const local_data_text = JSON.stringify(local_event_obj?.data ?? {})

      g_flutter_event_text = `${local_event_name}: ${local_data_text}`

      // Native AR 종료 → WEB 카메라 stream으로
      if (local_event_name === 'closed') {
        g_camera_active = false
        setTimeout(() => {
          g_camera_active = true
        }, 200)
      }
    })

    get_all_glasses()
      .then((local_glass_arr) => {
        const local_normalized_glass_arr = normalize_glasses_arr(local_glass_arr)
        g_all_glasses_arr = local_normalized_glass_arr
        g_recommended_arr = local_normalized_glass_arr.slice(0, 3)
      })
      .catch(() => {
        g_all_glasses_arr = []
        g_recommended_arr = []
        g_selected_id = null
      })
      .finally(() => {
        g_loading = false
      })

    return () => {
      local_remove_flutter_listener()
    }
  })

  /**
   * 안경 선택 시 id를 저장하고 캡쳐 슬롯을 초기화
   * 이미 5개를 채웠다면 토스트 경고 후 차단
   */
  function on_click_select_glasses(id) {
    if (g_saved_fittings_arr.length >= MAX_FITTINGS) {
      show_toast(
        `피팅은 최대 ${MAX_FITTINGS}개까지만 저장할 수 있습니다. 저장된 피팅을 취소한 뒤 다시 시도하세요.`,
      )
      return
    }
    // 다른 안경으로 변경할 때만 캡쳐 슬롯/카메라 리셋. 같은 카드 재클릭은 AR 재진입만 허용.
    if (id !== g_selected_id) {
      clear_capture_slot_arr()
      g_selected_id = id
      ref_this_camera?.reset()
    }

    const local_glasses_obj =
      g_glasses_arr.find((local_item_obj) => local_item_obj.id === id) ?? null
    if (local_glasses_obj && g_flutter_bridge_ready && g_flutter_availability === 'SUPPORTED') {
      void launch_flutter_fitting_for_glasses(local_glasses_obj)
    }
  }

  function build_flutter_fitting_payload(glasses_obj) {
    const local_asset_path = get_virtual_fitting_asset_path(glasses_obj)
    const local_model_url = get_virtual_fitting_model_url(glasses_obj)
    const local_product_id = glasses_obj?.glasses_no ?? glasses_obj?.id ?? ''

    return {
      product_id: String(local_product_id),
      product_name: String(glasses_obj?.model ?? 'unknown'),
      asset_path: local_asset_path,
      model_url: local_model_url,
      cache_key: `glasses-${String(local_product_id)}`,
    }
  }

  async function launch_flutter_fitting_for_glasses(glasses_obj) {
    const local_fitting_payload_obj = build_flutter_fitting_payload(glasses_obj)

    if (!local_fitting_payload_obj.asset_path && !local_fitting_payload_obj.model_url) {
      throw new Error('선택한 안경의 3D 파일 경로를 찾지 못했습니다.')
    }

    return launch_virtual_fitting(local_fitting_payload_obj)
  }

  /**
   * 현재 화면을 캡쳐하여 다음 빈 슬롯에 추가
   */
  async function on_click_capture() {
    if (g_next_slot_idx === -1 || g_is_capturing || !ref_this_camera) return

    g_is_capturing = true

    try {
      const local_is_captured = await ref_this_camera.trigger_capture()

      if (!local_is_captured) {
        show_toast('카메라가 준비되지 않아 캡처하지 못했습니다.')
      }
    } finally {
      g_is_capturing = false
    }
  }

  /**
   * 해당 캡쳐 슬롯의 이미지를 삭제
   */
  function on_capture_camera(local_capture_obj) {
    if (g_next_slot_idx === -1) {
      URL.revokeObjectURL(local_capture_obj.object_url)
      return
    }

    const local_file_obj = new File(
      [local_capture_obj.blob],
      `arfitting_${String(g_next_slot_idx + 1)}_${String(local_capture_obj.captured_at)}.jpg`,
      { type: local_capture_obj.blob.type || 'image/jpeg' },
    )

    const local_capture_slot_obj = {
      file_obj: local_file_obj,
      object_url: local_capture_obj.object_url,
      captured_at: local_capture_obj.captured_at,
    }

    const local_capture_slot_arr = [...g_capture_slot_arr]
    local_capture_slot_arr[g_next_slot_idx] = local_capture_slot_obj
    g_capture_slot_arr = local_capture_slot_arr

    ref_this_camera?.reset()
  }

  function on_capture_camera_error() {
    g_is_capturing = false
    show_toast('카메라 촬영에 실패했습니다.')
  }

  function on_click_reset_slot(idx) {
    const local_capture_slot_obj = g_capture_slot_arr[idx]

    if (local_capture_slot_obj?.object_url) {
      URL.revokeObjectURL(local_capture_slot_obj.object_url)
    }

    const local_capture_slot_arr = [...g_capture_slot_arr]
    local_capture_slot_arr[idx] = null
    g_capture_slot_arr = local_capture_slot_arr
  }

  /**
   * 저장된 피팅 목록에서 특정 항목 제거
   */
  function on_click_remove_saved(idx) {
    g_saved_fittings_arr = g_saved_fittings_arr.filter((_, i) => i !== idx)
  }

  function clear_capture_slot_arr() {
    for (const local_capture_slot_obj of g_capture_slot_arr) {
      if (local_capture_slot_obj?.object_url) {
        URL.revokeObjectURL(local_capture_slot_obj.object_url)
      }
    }

    g_capture_slot_arr = [null, null, null]
  }

  let g_submit_loading = $state(false)
  let g_submit_error = $state('')

  /**
   * 3장 캡쳐된 현재 피팅을 API로 저장. Presigned URL 발급 → S3 업로드 → 백엔드 확정
   */
  async function on_click_save_fitting() {
    if (!g_can_save || g_submit_loading) return
    g_submit_loading = true
    g_submit_error = ''
    try {
      const local_visit_no = $selected_visit_obj?.visit_no
      const glasses_info = g_glasses_arr.find((g) => g.id === g_selected_id)
      const local_glasses_no = glasses_info?.glasses_no ?? g_selected_id

      // 안경별 Presigned URL 발급 (front/left/right)
      const local_presigned = await request_fitting_presigned_urls(local_visit_no, local_glasses_no)

      // front, left, right 순으로 S3에 PUT
      const local_file_arr = g_capture_slot_arr.map((local_capture_slot_obj) =>
        local_capture_slot_obj?.file_obj instanceof File
          ? local_capture_slot_obj.file_obj
          : new File([new Blob(['dummy'], { type: 'image/jpeg' })], 'capture.jpg', {
              type: 'image/jpeg',
            }),
      )
      const local_url_arr = [
        local_presigned.front_url,
        local_presigned.left_url,
        local_presigned.right_url,
      ]
      await Promise.all(
        local_url_arr.map((url, idx) =>
          fetch(url, {
            method: 'PUT',
            body: local_file_arr[idx],
          }).then((res) => {
            if (!res.ok) throw new Error(`S3 업로드 실패 (${res.status})`)
          }),
        ),
      )

      // 업로드된 key 배열 백엔드로 보내 저장
      await confirm_fitting_result(local_visit_no, {
        vp_file_arr: [
          local_presigned.front_key,
          local_presigned.left_key,
          local_presigned.right_key,
        ],
        vp_json: { glasses_no: local_glasses_no, fitting_result: {} },
      })

      // 로컬 저장 목록 업데이트 및 슬롯 초기화
      g_saved_fittings_arr = [
        ...g_saved_fittings_arr,
        {
          glasses_id: g_selected_id,
          glasses_no: local_glasses_no,
          brand: glasses_info?.brand ?? '',
          model: glasses_info?.model ?? '',
          captures: [...g_capture_slot_arr],
        },
      ]
      clear_capture_slot_arr()
      ref_this_camera?.reset()
    } catch (local_err) {
      g_submit_error = local_err instanceof Error ? local_err.message : '저장에 실패했습니다.'
    } finally {
      g_submit_loading = false
    }
  }

  /**
   * 저장된 피팅이 1개 이상이면 리포트 페이지로 이동
   */
  function on_click_submit_report() {
    if (!g_can_submit) return
    window.location.href = PATH.analysisResult
  }

  function on_click_go_back() {
    if (window.history.length > 1) {
      window.history.back()
      return
    }

    navigate(PATH.analysisLensConsult)
  }

  function on_click_logout() {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('token_no')
    clear_login_select_data()
    clear_auto_login_obj()
    navigate(PATH.login)
  }

  /**
   * 선택한 안경의 native asset 경로를 확인하고 Flutter AR 피팅 화면 열기
   */
  async function on_click_launch_flutter_fitting() {
    if (!g_flutter_bridge_ready) {
      show_toast('Flutter 브리지가 연결되지 않았습니다.')
      return
    }

    if (g_flutter_availability !== 'SUPPORTED') {
      show_toast(`네이티브 AR 사용 불가 상태입니다. (${g_flutter_availability})`)
      return
    }

    if (!g_selected_glasses_obj) {
      show_toast('선택한 안경의 native asset 경로를 찾지 못했습니다.')
      return
    }

    g_flutter_launch_loading = true

    try {
      const local_request_id = await launch_flutter_fitting_for_glasses(g_selected_glasses_obj)

      g_flutter_event_text = `launch_requested: ${local_request_id}`
      show_toast('Flutter AR 피팅을 실행했습니다.')
    } catch (local_error) {
      const local_error_text =
        local_error instanceof Error ? local_error.message : 'Flutter AR 피팅 실행에 실패했습니다.'

      g_flutter_event_text = `launch_error: ${local_error_text}`
      show_toast(local_error_text)
    } finally {
      g_flutter_launch_loading = false
    }
  }

  /**
   * 필터 모달 열기 시 전체 안경 목록을 한 번만 fetch
   */
  async function on_click_open_filter_modal() {
    g_filter_modal_open = true
    if (g_all_glasses_arr.length > 0) return
    g_filter_loading = true
    try {
      const local_glass_arr = await get_all_glasses()
      g_all_glasses_arr = normalize_glasses_arr(local_glass_arr)
    } catch {
      g_all_glasses_arr = []
    } finally {
      g_filter_loading = false
    }
  }

  /**
   * 필터 옵션 토글 (즉시 반영)
   */
  function on_click_toggle_filter(field, value) {
    const arr = g_filter_obj[field]
    g_filter_obj[field] = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
  }

  /**
   * 필터 전체 초기화
   */
  function on_click_reset_filter() {
    g_filter_obj = { frame_type_arr: [], material_arr: [], category_arr: [] }
  }

  let g_guide_step = $state(0)

  const GUIDE_STEP_ARR = [
    null,
    {
      title: '착용할 안경을 선택해 주세요',
      desc: '오른쪽 목록에서 원하는 안경을 선택해 주세요.\n선택하면 카메라 화면에 AR 피팅이 적용됩니다.',
      hint: '오른쪽 안경 목록을 확인해 주세요.',
      card_style: 'right: 468px; top: 50%; transform: translateY(-50%)',
    },
    {
      title: '3장을 촬영해 주세요',
      desc: '촬영 버튼을 눌러 정면, 측면 좌, 측면 우 순서로 3장을 찍어 주세요.\n3장을 모두 찍어야 피팅 결과를 저장할 수 있습니다.',
      hint: '카메라를 바라보고 촬영해 주세요.',
      card_style: 'left: 40px; bottom: 168px',
    },
    {
      title: '촬영 상태를 확인해 주세요',
      desc: '3개의 슬롯이 모두 채워졌는지 확인해 주세요.\nX 버튼으로 다시 촬영할 수 있습니다.\n다른 안경을 선택하면 현재 촬영 중인 사진은 초기화됩니다.',
      hint: '오른쪽 상단 슬롯을 확인해 주세요.',
      card_style: 'right: 468px; top: 80px',
    },
    {
      title: '피팅 결과를 저장해요',
      desc: '3장 촬영이 완료되면 [피팅 결과 저장] 버튼이 활성화됩니다.\n저장 후 다른 안경도 최대 5개까지 시도할 수 있습니다.\n3장 미완료 상태에서는 저장되지 않습니다.',
      hint: '오른쪽 하단 왼쪽 버튼을 눌러 주세요.',
      card_style: 'right: 468px; bottom: 72px',
    },
    {
      title: '최종 리포트를 확인해 주세요',
      desc: '피팅 결과가 1개 이상 저장되면 [최종 분석 리포트 확인] 버튼이 활성화됩니다.\n저장한 안경들을 한 번에 AI가 분석합니다.',
      hint: '오른쪽 하단 오른쪽 버튼을 눌러 주세요.',
      card_style: 'right: 468px; bottom: 72px',
    },
  ]

  let g_guide_info = $derived(GUIDE_STEP_ARR[g_guide_step])

  function on_click_guide_open() {
    g_guide_step = 1
  }
  function on_click_guide_close() {
    g_guide_step = 0
  }
  function on_click_guide_next() {
    if (g_guide_step < 5) g_guide_step++
    else g_guide_step = 0
  }
  function on_click_guide_prev() {
    if (g_guide_step > 1) g_guide_step--
  }

  let g_highlight_camera = $derived(g_guide_step === 2)
  let g_highlight_aside = $derived([1, 3, 4, 5].includes(g_guide_step))

  let g_permission_state = $state(
    /** @type {'granted' | 'denied' | 'prompt' | 'unsupported'} */ ('prompt'),
  )
  let g_permission_modal_open = $state(false)

  // 카메라 권한 요청
  async function on_click_allow_camera() {
    const local_ok = await request_camera_permission()
    g_permission_state = local_ok ? 'granted' : 'denied'
  }

  // 사용자가 완료를 눌러 모달을 닫음
  function on_click_close_camera_modal() {
    g_permission_modal_open = false
  }

  onMount(() => {
    let local_unwatch = /** @type {(() => void) | null} */ (null)
    let local_cancelled = false

    ;(async () => {
      const local_state = await check_camera_permission_state()
      if (local_cancelled) return

      g_permission_state = local_state
      if (local_state !== 'granted' && local_state !== 'unsupported') {
        g_permission_modal_open = true
      }

      local_unwatch = await watch_camera_permission_change((local_next_state) => {
        g_permission_state = local_next_state
        if (local_next_state !== 'granted' && local_next_state !== 'unsupported') {
          g_permission_modal_open = true
        }
      })

      if (local_cancelled) {
        local_unwatch?.()
        local_unwatch = null
      }
    })()

    return () => {
      local_cancelled = true
      local_unwatch?.()
    }
  })
</script>

<main class="app-frame-page flex h-full flex-col overflow-hidden bg-white text-zinc-900">
  <Header onback={on_click_go_back} onlogout={on_click_logout} />

  <div class="flex min-h-0 flex-1 overflow-hidden bg-[var(--retina-text-100)]">
    <!-- 좌측: 카메라 -->
    <section
      class="relative flex min-h-0 flex-1 flex-col transition-[z-index]"
      class:z-50={g_highlight_camera}
    >
      <div
        class="arfitting-camera-fill relative min-h-0 flex-1 overflow-hidden bg-zinc-950 shadow-inner transition-all"
        class:ring-4={g_highlight_camera}
        class:ring-[var(--retina-primary-200)]={g_highlight_camera}
        class:ring-offset-4={g_highlight_camera}
      >
        <div class="absolute inset-0 overflow-hidden">
          <CameraView
            bind:this={ref_this_camera}
            active={g_camera_active}
            pose_target={g_camera_pose_target}
            capture_mode="manual"
            show_overlay={false}
            oncapture={on_capture_camera}
            oncapture_error={on_capture_camera_error}
          />
        </div>

        {#if g_show_intro}
          <div
            class="absolute left-1/2 top-3 z-10 -translate-x-1/2"
            in:fly={{ y: -10, duration: 400 }}
            out:fade={{ duration: 500 }}
          >
            <div
              class="inline-flex items-center gap-2 rounded-full bg-[var(--retina-primary-300)] px-5 py-2 shadow-[0_4px_12px_rgba(249,115,22,0.35)]"
            >
              <Glasses size={14} class="shrink-0 text-white" />
              <span class="whitespace-nowrap text-[12px] font-bold text-white">
                현재 시야로 보고
              </span>
            </div>
          </div>
        {/if}

        <button
          type="button"
          onclick={on_click_guide_open}
          class="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[9px] font-bold text-slate-600 shadow backdrop-blur-md transition-colors hover:bg-white hover:text-[var(--retina-primary-300)]"
        >
          <HelpCircle size={10} />
          <span>사용 가이드</span>
        </button>

        {#if g_next_slot_idx !== -1}
          <div
            class="absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
          >
            <p
              class="rounded-full bg-black/40 px-3 py-0.5 text-[11px] font-medium text-white/80 backdrop-blur-md"
            >
              {SLOT_LABEL_ARR[g_next_slot_idx]} 각도를 촬영해주세요
            </p>
            <button
              type="button"
              onclick={on_click_capture}
              aria-label="{SLOT_LABEL_ARR[g_next_slot_idx]} 촬영"
              class="group flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-2xl transition-transform hover:scale-110 active:scale-95"
            >
              <div
                class="flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white"
              >
                <div
                  class="h-9 w-9 rounded-full bg-white transition-all group-hover:bg-[var(--retina-primary-100)]"
                ></div>
              </div>
            </button>
          </div>
        {/if}
        {#if g_flutter_bridge_ready}
          <div
            class="absolute left-3 top-3 rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-[10px] text-white/85 backdrop-blur-md"
          >
            <p class="font-black">Flutter Bridge</p>
            <p class="mt-0.5">status: {g_flutter_availability}</p>
            <p class="mt-0.5">asset: {g_selected_asset_path || 'none'}</p>
            <p class="mt-0.5">model: {g_selected_model_url || 'none'}</p>
            {#if g_flutter_event_text}
              <p class="mt-0.5 max-w-56 break-all text-white/70">{g_flutter_event_text}</p>
            {/if}
          </div>
        {/if}
      </div>
    </section>

    <!-- 우측: 캡쳐 상태 + 추천 안경 + 액션 버튼 -->
    <aside
      class="relative flex w-[300px] flex-col border-l border-slate-200 bg-white transition-[z-index]"
      class:z-50={g_highlight_aside}
    >
      <!-- 캡쳐 슬롯 -->
      <div
        class="px-4 pt-3 pb-2 transition-all"
        class:ring-4={g_guide_step === 3}
        class:ring-[var(--retina-primary-200)]={g_guide_step === 3}
        class:ring-inset={g_guide_step === 3}
      >
        <h2 class="mb-2 text-[11px] font-extrabold tracking-wide text-slate-500">촬영 상태</h2>
        <div class="grid grid-cols-3 gap-2">
          {#each g_capture_slot_arr as slot, idx (idx)}
            <div class="group relative flex flex-col items-center gap-1">
              <div
                class={`relative flex h-[120px] w-full items-center justify-center rounded-lg border transition-all ${
                  slot
                    ? 'border-[var(--retina-primary-300)] bg-[var(--retina-bg-1)]'
                    : idx === g_next_slot_idx
                      ? 'animate-pulse border-dashed border-slate-300 bg-slate-50'
                      : 'border-slate-200 bg-slate-50'
                }`}
              >
                {#if slot}
                  <img
                    src={slot.object_url}
                    alt={SLOT_LABEL_ARR[idx]}
                    class="h-full w-full rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onclick={() => on_click_reset_slot(idx)}
                    aria-label="다시 촬영"
                    class="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-400 shadow-md hover:text-red-500"
                  >
                    <X size={11} />
                  </button>
                {:else}
                  <img
                    src={SLOT_ICON_ARR[idx]}
                    alt={`${SLOT_LABEL_ARR[idx]} 안내`}
                    class="h-[18px] w-[18px] object-contain opacity-70"
                  />
                {/if}
              </div>
              <span class={`text-[10px] font-bold ${slot ? 'text-[var(--retina-primary-300)]' : 'text-slate-400'}`}
                >{SLOT_LABEL_ARR[idx]}</span
              >
            </div>
          {/each}
        </div>
      </div>

      <hr class="mx-4 my-1 border-slate-200" />

      <!-- 추천 안경 목록 -->
      <div
        class="flex min-h-0 flex-1 flex-col px-4 pt-2 transition-all"
        class:ring-4={g_guide_step === 1}
        class:ring-[var(--retina-primary-200)]={g_guide_step === 1}
        class:ring-inset={g_guide_step === 1}
      >
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-[13px] font-extrabold text-zinc-900">추천 안경</h2>
          <button
            type="button"
            onclick={on_click_open_filter_modal}
            class="flex items-center gap-1 rounded-lg border border-[var(--retina-primary-500)] bg-white px-2 py-1 text-[10px] font-bold text-[var(--retina-primary-500)] transition-colors hover:bg-[var(--retina-bg-1)]"
          >
            <SlidersHorizontal size={11} />
            <span>프레임 변경</span>
            {#if g_active_filter_count > 0}
              <span
                class="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--retina-primary-300)] text-[9px] font-black text-white"
              >
                {g_active_filter_count}
              </span>
            {/if}
          </button>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {#if g_loading}
            <div class="flex justify-center py-10">
              <span
                class="h-5 w-5 animate-spin rounded-full border-2 border-[var(--retina-primary-200)] border-t-transparent"
              ></span>
            </div>
          {:else if g_glasses_arr.length === 0}
            <div class="flex flex-col items-center gap-2 py-10 text-center">
              <Glasses size={28} class="text-slate-200" />
              <p class="text-[12px] font-bold text-slate-400">조건에 맞는 안경이 없습니다</p>
              <button
                type="button"
                onclick={on_click_reset_filter}
                class="text-[11px] font-bold text-[var(--retina-primary-300)] underline underline-offset-2"
              >
                필터 초기화
              </button>
            </div>
          {:else}
            <div class="flex flex-col gap-2 pb-2">
              {#each g_glasses_arr as item (item.id)}
                {@const active = item.id === g_selected_id}
                {@const saved_count = g_saved_count_map[item.id] ?? 0}
                <button
                  type="button"
                  onclick={() => on_click_select_glasses(item.id)}
                  class={`group relative flex items-center gap-2.5 rounded-xl border p-2 text-left transition-all ${
                    active
                      ? 'border-[var(--retina-primary-300)] bg-[var(--retina-bg-1)] shadow-sm'
                      : 'border-slate-200 bg-white hover:border-[var(--retina-primary-100)]'
                  }`}
                >
                  <div
                    class="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-50 p-1"
                  >
                    <img src={item.img_url} alt={item.model} class="h-full w-full object-contain" />
                  </div>
                  <div class="flex flex-1 flex-col overflow-hidden">
                    {#if active}
                      <span
                        class="mb-0.5 inline-flex items-center gap-1 self-start text-[10px] font-extrabold text-[var(--retina-primary-500)]"
                      >
                        <span
                          class="h-3 w-3 shrink-0 bg-[var(--retina-primary-500)]"
                          style="mask: url('/circle-check-red.png') center/contain no-repeat; -webkit-mask: url('/circle-check-red.png') center/contain no-repeat;"
                          aria-label="피팅중 체크"
                        ></span>
                        피팅중
                      </span>
                    {/if}
                    <p class="truncate text-[12px] font-extrabold text-zinc-900">{item.model}</p>
                    <span class="truncate text-[10px] font-semibold text-slate-400"
                      >{item.brand} · {item.frame_type}</span
                    >
                    <div class="mt-0.5 flex items-center justify-between gap-1.5">
                      <span class="text-[11px] font-extrabold text-[var(--retina-primary-300)]"
                        >₩{item.price}</span
                      >
                      {#if !active && saved_count > 0}
                        <span
                          class="rounded bg-[var(--retina-bg-1)] px-1.5 py-px text-[9px] font-bold text-[var(--retina-primary-300)]"
                        >
                          저장됨
                        </span>
                      {/if}
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- 저장된 피팅 목록 + 액션 버튼 -->
      <div
        class="border-t border-slate-100 bg-white px-4 py-3 transition-all"
        class:ring-4={g_guide_step === 4 || g_guide_step === 5}
        class:ring-[var(--retina-primary-200)]={g_guide_step === 4 || g_guide_step === 5}
        class:ring-inset={g_guide_step === 4 || g_guide_step === 5}
      >
        {#if g_saved_fittings_arr.length > 0}
          <div class="mb-2">
            <div class="mb-1 flex items-center justify-between">
              <span class="text-[10px] font-extrabold tracking-wide text-slate-500">
                저장된 피팅 ({g_saved_fittings_arr.length}/{MAX_FITTINGS})
              </span>
              {#if g_saved_fittings_arr.length >= MAX_FITTINGS}
                <span class="text-[10px] font-bold text-amber-500">최대</span>
              {/if}
            </div>
            <div class="flex gap-1 overflow-x-auto pb-0.5 custom-scrollbar">
              {#each g_saved_fittings_arr as fit, idx (idx)}
                <div
                  class="flex shrink-0 items-center gap-1 rounded-lg bg-[var(--retina-bg-1)] px-2 py-1"
                  in:fly={{ y: 6, duration: 200 }}
                >
                  <CheckCheck size={9} class="shrink-0 text-[var(--retina-primary-300)]" />
                  <span class="max-w-[60px] truncate text-[10px] font-bold text-[var(--retina-primary-300)]"
                    >{fit.model}</span
                  >
                  <button
                    type="button"
                    onclick={() => on_click_remove_saved(idx)}
                    aria-label="피팅 제거"
                    class="ml-0.5 shrink-0 text-slate-400 transition-colors hover:text-red-400"
                  >
                    <X size={9} />
                  </button>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if g_submit_error}
          <p class="mb-2 text-[10px] font-bold text-red-500" role="alert">{g_submit_error}</p>
        {/if}

        <p class="mb-1.5 text-center text-[10px] font-semibold text-slate-500">
          촬영 완료 후 피팅 결과를 저장하세요.
        </p>

        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!g_can_save || g_submit_loading}
            onclick={on_click_save_fitting}
            class="flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-[var(--retina-primary-300)] bg-white py-1.5 text-[12px] font-extrabold text-[var(--retina-primary-300)] shadow-sm transition-all hover:bg-[var(--retina-bg-1)] disabled:cursor-not-allowed disabled:opacity-30 disabled:grayscale"
          >
            {#if g_submit_loading}
              <span
                class="h-3 w-3 animate-spin rounded-full border-2 border-[var(--retina-primary-300)] border-t-transparent"
              ></span>
              <span>저장 중</span>
            {:else}
              <Save size={14} />
              <span>피팅 결과 저장</span>
            {/if}
          </button>

          <button
            type="button"
            disabled={!g_can_submit}
            onclick={on_click_submit_report}
            class="flex min-h-[56px] flex-col items-center justify-center gap-0.5 rounded-lg border-0 bg-[var(--retina-primary-300)] py-1.5 text-[12px] font-extrabold text-white shadow-md transition-all hover:bg-[var(--retina-primary-400)] disabled:cursor-not-allowed disabled:opacity-30 disabled:grayscale"
          >
            <FileText size={14} />
            <span>리포트 확인</span>
          </button>
        </div>
      </div>
    </aside>
  </div>
</main>

<!-- 프레임 필터 드로어 -->
{#if g_filter_modal_open}
  <div
    class="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
    role="presentation"
    onclick={() => (g_filter_modal_open = false)}
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
        {#if g_filter_loading}
          <p class="mt-0.5 text-xs text-slate-400">안경 목록 불러오는 중...</p>
        {:else}
          <p class="mt-0.5 text-xs text-slate-400">전체 {g_all_glasses_arr.length}개</p>
        {/if}
      </div>
      <button
        type="button"
        onclick={() => (g_filter_modal_open = false)}
        class="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <X size={20} />
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      {#if g_filter_loading}
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
                {@const selected = g_filter_obj.frame_type_arr.includes(opt)}
                <button
                  type="button"
                  onclick={() => on_click_toggle_filter('frame_type_arr', opt)}
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
                {@const selected = g_filter_obj.material_arr.includes(opt)}
                <button
                  type="button"
                  onclick={() => on_click_toggle_filter('material_arr', opt)}
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
                {@const selected = g_filter_obj.category_arr.includes(opt)}
                <button
                  type="button"
                  onclick={() => on_click_toggle_filter('category_arr', opt)}
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
        {#if g_active_filter_count > 0}
          <span class="text-[var(--retina-primary-300)]">{g_glasses_arr.length}개</span>의 안경이 검색됩니다
        {:else}
          필터를 선택하면 실시간으로 결과가 반영됩니다
        {/if}
      </p>
      <div class="flex gap-3">
        <button
          type="button"
          onclick={on_click_reset_filter}
          disabled={g_active_filter_count === 0}
          class="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 py-3.5 text-sm font-bold text-slate-500 transition-all hover:border-slate-300 hover:bg-white disabled:opacity-40"
        >
          <RotateCcw size={14} />
          초기화
        </button>
        <button
          type="button"
          onclick={() => (g_filter_modal_open = false)}
          class="flex flex-[2] items-center justify-center rounded-2xl bg-[var(--retina-primary-300)] py-3.5 text-sm font-black text-white transition-colors hover:bg-[var(--retina-primary-400)]"
        >
          적용하기
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- 가이드 오버레이 -->
{#if g_guide_step > 0}
  <div
    class="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
    role="presentation"
    onclick={on_click_guide_close}
    in:fade={{ duration: 250 }}
    out:fade={{ duration: 200 }}
  ></div>

  {#if g_guide_info}
    <div
      class="fixed z-50 w-80 rounded-3xl bg-white p-6 shadow-2xl"
      style={g_guide_info.card_style}
      in:fly={{ y: 8, duration: 300 }}
      out:fade={{ duration: 150 }}
    >
      <div class="mb-5 flex gap-1.5">
        {#each [1, 2, 3, 4, 5] as step_num (step_num)}
          <div
            class="h-1.5 flex-1 rounded-full transition-colors duration-300 {g_guide_step >=
            step_num
              ? 'bg-[var(--retina-primary-200)]'
              : 'bg-slate-100'}"
          ></div>
        {/each}
      </div>
      <p class="mb-1.5 text-xs font-black uppercase tracking-widest text-[var(--retina-primary-300)]">
        Step {g_guide_step} / 5
      </p>
      <h3 class="mb-3 text-lg font-black leading-snug text-zinc-900">{g_guide_info.title}</h3>
      <p class="whitespace-pre-line text-sm leading-relaxed text-slate-500">{g_guide_info.desc}</p>
      <div class="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-[var(--retina-bg-1)] px-4 py-3">
        <span class="text-xs font-bold text-[var(--retina-primary-300)]">{g_guide_info.hint}</span>
        <ChevronRight size={14} class="shrink-0 text-[var(--retina-primary-300)]" />
      </div>
      <div class="mt-5 flex items-center justify-between">
        <button
          type="button"
          onclick={on_click_guide_close}
          class="text-xs font-bold text-slate-400 transition-colors hover:text-slate-600"
        >
          건너뛰기
        </button>
        <div class="flex gap-2">
          {#if g_guide_step > 1}
            <button
              type="button"
              onclick={on_click_guide_prev}
              class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
            >
              이전
            </button>
          {/if}
          <button
            type="button"
            onclick={on_click_guide_next}
            class="rounded-xl bg-[var(--retina-primary-300)] px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-[var(--retina-primary-400)]"
          >
            {g_guide_step < 5 ? '다음' : '시작하기'}
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<!-- 토스트 알림 -->
{#if g_toast_msg}
  <div
    class="fixed bottom-8 left-1/2 z-[60] -translate-x-1/2"
    in:fly={{ y: 12, duration: 250 }}
    out:fade={{ duration: 200 }}
  >
    <div
      class="flex items-center gap-3 rounded-2xl bg-zinc-900/95 px-5 py-3.5 shadow-2xl backdrop-blur-md"
    >
      <span class="text-sm font-bold text-white">{g_toast_msg}</span>
    </div>
  </div>
{/if}

<CameraPermissionModal
  open={g_permission_modal_open}
  permission_state={g_permission_state}
  onallow={on_click_allow_camera}
  onclose={on_click_close_camera_modal}
/>

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

  /* CameraView 컴포넌트가 내부에 가진 rounded-lg 모서리 제거 */
  :global(.arfitting-camera-fill .rounded-lg) {
    border-radius: 0 !important;
  }
</style>
