<script>
  import { onMount } from 'svelte'
  import { navigate } from '@maks11060/svelte5-router'
  import { fade, fly } from 'svelte/transition'
  import {
    Glasses,
    CheckCheck,
    X,
    ChevronRight,
    RefreshCw,
    Save,
    FileText,
  } from 'lucide-svelte'
  import Header from '@/components/layout/header.svelte'
  import { PATH } from '@/config/path'
  import {
    load_normalized_glasses,
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
  import { selected_customer_obj, selected_visit_obj } from '@/lib/stores/customer'
  import { pick_recommended_glasses_arr } from '@/lib/recommendations/frame_recommendations'

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
  let g_flutter_bridge_ready = $state(false)
  let g_flutter_availability = $state('UNKNOWN')
  let g_flutter_event_text = $state('')
  let g_flutter_launch_loading = $state(false)
  // native AR 이 정확히 이 placeholder 영역에 매칭되도록 ref 로 측정해 좌표를 전달한다.
  /** @type {HTMLDivElement | null} */
  let ref_camera_section_el = $state(null)

  const SLOT_LABEL_ARR = ['정면', '좌측', '우측']
  const SLOT_ICON_ARR = [
    '/icons/face_center.png',
    '/icons/face_left.png',
    '/icons/face_right.png',
  ]
  // native 가 emit 하는 slot 키 -> 슬롯 인덱스 매핑
  const SLOT_KEY_TO_INDEX = { front: 0, left: 1, right: 2 }
  const MAX_FITTINGS = 5

  let g_all_captured = $derived(g_capture_slot_arr.every((s) => s !== null))

  // { glasses_id, brand, model, captures } 형태로 최대 5개 저장
  let g_saved_fittings_arr = $state([])

  // 현재 선택한 안경이 이미 저장된 적이 있는지 (있으면 새 캡쳐로 덮어쓰는 모드)
  let g_is_selected_already_saved = $derived(
    g_selected_id !== null &&
      g_saved_fittings_arr.some((local_obj) => local_obj.glasses_id === g_selected_id),
  )

  let g_can_save = $derived(
    g_all_captured &&
      (g_saved_fittings_arr.length < MAX_FITTINGS || g_is_selected_already_saved),
  )
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

  // 현재 선택된 고객의 얼굴형/피부톤 기준으로 추천 3개를 뽑는다.
  function get_personalized_recommended_arr(glass_arr) {
    return pick_recommended_glasses_arr(
      glass_arr,
      $selected_customer_obj?.face_shape,
      $selected_customer_obj?.skin_tone,
    )
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
      const local_data_obj = local_event_obj?.data ?? {}
      const local_data_text = JSON.stringify(local_data_obj)

      g_flutter_event_text = `${local_event_name}: ${local_data_text}`

      // native AR 가 캡처한 이미지를 슬롯에 채운다.
      if (local_event_name === 'captured') {
        on_native_captured(local_data_obj)
      }
    })

    load_normalized_glasses()
      .then((local_normalized_glass_arr) => {
        g_all_glasses_arr = local_normalized_glass_arr
        g_recommended_arr = get_personalized_recommended_arr(local_normalized_glass_arr)
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
    const local_already_saved = g_saved_fittings_arr.some(
      (local_obj) => local_obj.glasses_id === id,
    )
    // 5개를 다 채웠더라도 이미 저장된 안경을 재선택해 사진을 갱신하는 것은 허용한다.
    if (g_saved_fittings_arr.length >= MAX_FITTINGS && !local_already_saved) {
      show_toast(
        `피팅은 최대 ${MAX_FITTINGS}개까지만 저장할 수 있습니다. 저장된 피팅을 취소한 뒤 다시 시도하세요.`,
      )
      return
    }
    // 다른 안경으로 변경할 때만 캡쳐 슬롯 리셋.
    if (id !== g_selected_id) {
      clear_capture_slot_arr()
      g_selected_id = id
    }

    // 안경 선택과 동시에 native AR 화면을 띄운다. 카메라 + 캡처 모두 native 가 담당.
    const local_glasses_obj =
      g_glasses_arr.find((local_item_obj) => local_item_obj.id === id) ?? null
    if (local_glasses_obj && g_flutter_bridge_ready && g_flutter_availability === 'SUPPORTED') {
      void launch_flutter_fitting_for_glasses(local_glasses_obj).catch((local_err) => {
        const local_err_text =
          local_err instanceof Error ? local_err.message : 'AR 피팅 실행에 실패했습니다.'
        show_toast(local_err_text)
      })
    } else if (!g_flutter_bridge_ready) {
      show_toast('Flutter 브리지 연결을 기다리는 중입니다. 잠시 후 다시 선택해주세요.')
    } else if (g_flutter_availability !== 'SUPPORTED') {
      show_toast(`네이티브 AR 사용 불가 상태입니다. (${g_flutter_availability})`)
    }
  }

  /**
   * Flutter native 에서 base64 JPEG 와 slot 키로 도착한 캡처 결과를 슬롯에 반영한다.
   * data: { slot: 'front' | 'left' | 'right', image_base64: string }
   */
  function on_native_captured(data_obj) {
    const local_slot_key = String(data_obj?.slot ?? '')
    const local_base64_text = String(data_obj?.image_base64 ?? '')
    const local_slot_idx = SLOT_KEY_TO_INDEX[local_slot_key]

    if (!Number.isInteger(local_slot_idx) || !local_base64_text) {
      return
    }

    let local_byte_arr
    try {
      const local_binary_text = atob(local_base64_text)
      local_byte_arr = new Uint8Array(local_binary_text.length)
      for (let i = 0; i < local_binary_text.length; i++) {
        local_byte_arr[i] = local_binary_text.charCodeAt(i)
      }
    } catch {
      show_toast('캡처 이미지 디코딩에 실패했습니다.')
      return
    }

    const local_blob = new Blob([local_byte_arr], { type: 'image/jpeg' })
    const local_captured_at = Date.now()
    const local_file_obj = new File(
      [local_blob],
      `arfitting_${String(local_slot_idx + 1)}_${String(local_captured_at)}.jpg`,
      { type: 'image/jpeg' },
    )
    const local_object_url = URL.createObjectURL(local_blob)

    const local_capture_slot_arr = [...g_capture_slot_arr]
    // 같은 슬롯이 이미 채워져있으면 기존 object_url 을 revoke 해 메모리 누수를 막는다.
    const local_prev_slot_obj = local_capture_slot_arr[local_slot_idx]
    if (local_prev_slot_obj?.object_url) {
      URL.revokeObjectURL(local_prev_slot_obj.object_url)
    }
    local_capture_slot_arr[local_slot_idx] = {
      file_obj: local_file_obj,
      object_url: local_object_url,
      captured_at: local_captured_at,
    }
    g_capture_slot_arr = local_capture_slot_arr
  }

  function build_flutter_fitting_payload(glasses_obj) {
    const local_asset_path = get_virtual_fitting_asset_path(glasses_obj)
    const local_model_url = get_virtual_fitting_model_url(glasses_obj)
    const local_product_id = glasses_obj?.glasses_no ?? glasses_obj?.id ?? ''

    // native AR 은 fullscreen 으로 동작. window 좌표는 보내지 않는다.
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

      // front, left, right 순으로 S3에 PUT (캡쳐 시점에 이미 좌우 반전된 파일이 슬롯에 있음)
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

      // 로컬 저장 목록 업데이트 (같은 안경이면 기존 항목을 새 캡쳐로 교체, 아니면 append)
      const local_new_fitting_obj = {
        glasses_id: g_selected_id,
        glasses_no: local_glasses_no,
        brand: glasses_info?.brand ?? '',
        model: glasses_info?.model ?? '',
        captures: [...g_capture_slot_arr],
      }
      const local_existing_idx = g_saved_fittings_arr.findIndex(
        (local_obj) => local_obj.glasses_id === g_selected_id,
      )
      if (local_existing_idx >= 0) {
        const local_next_arr = [...g_saved_fittings_arr]
        local_next_arr[local_existing_idx] = local_new_fitting_obj
        g_saved_fittings_arr = local_next_arr
      } else {
        g_saved_fittings_arr = [...g_saved_fittings_arr, local_new_fitting_obj]
      }

      // result.svelte 용 sessionStorage 도 동일하게 같은 모델은 교체 정책으로 갱신한다.
      try {
        const local_capture_data_url_arr = await Promise.all(
          local_file_arr.map((local_file_obj) => read_file_as_data_url(local_file_obj)),
        )
        const local_persisted_fitting_obj = {
          brand: glasses_info?.brand ?? '',
          model: glasses_info?.model ?? '',
          capture_arr: SLOT_LABEL_ARR.map((local_label, local_idx) => ({
            label: local_label,
            src: local_capture_data_url_arr[local_idx] ?? '',
          })),
        }
        const local_existing_raw = sessionStorage.getItem('retinal_saved_fittings')
        const local_existing_arr_raw = local_existing_raw ? JSON.parse(local_existing_raw) : []
        const local_existing_arr = Array.isArray(local_existing_arr_raw)
          ? local_existing_arr_raw
          : []
        const local_persisted_idx = local_existing_arr.findIndex(
          (local_obj) =>
            local_obj?.brand === local_persisted_fitting_obj.brand &&
            local_obj?.model === local_persisted_fitting_obj.model,
        )
        let local_next_persisted_arr
        if (local_persisted_idx >= 0) {
          local_next_persisted_arr = [...local_existing_arr]
          local_next_persisted_arr[local_persisted_idx] = local_persisted_fitting_obj
        } else {
          local_next_persisted_arr = [...local_existing_arr, local_persisted_fitting_obj]
        }
        sessionStorage.setItem(
          'retinal_saved_fittings',
          JSON.stringify(local_next_persisted_arr),
        )
      } catch {
        // 저장 실패해도 본 흐름은 막지 않는다.
      }

      clear_capture_slot_arr()
    } catch (local_err) {
      g_submit_error = local_err instanceof Error ? local_err.message : '저장에 실패했습니다.'
    } finally {
      g_submit_loading = false
    }
  }

  // 가격 문자열을 천 단위 콤마 + "원" 으로 포맷한다 (예: "159000" → "159,000원").
  function format_price_label(price_value) {
    if (price_value === null || price_value === undefined) return ''
    const local_text = String(price_value).trim()
    if (!local_text) return ''
    const local_digits = local_text.replace(/[^0-9]/g, '')
    if (!local_digits) return local_text
    return `${Number(local_digits).toLocaleString('ko-KR')}원`
  }

  function read_file_as_data_url(file_obj) {
    return new Promise((resolve, reject) => {
      const local_reader = new FileReader()
      local_reader.onload = () => resolve(String(local_reader.result ?? ''))
      local_reader.onerror = () => reject(local_reader.error ?? new Error('파일 읽기 실패'))
      local_reader.readAsDataURL(file_obj)
    })
  }

  /**
   * 저장된 피팅이 1개 이상이면 리포트 페이지로 이동
   */
  function on_click_submit_report() {
    if (!g_can_submit) return
    window.location.href = PATH.analysisResult
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
   * 프레임 변경 버튼: 이미 불러온 안경 목록에서 추천 슬롯만 다시 추첨
   * (API 재호출은 하지 않음 — 페이지 진입 시 한 번만 호출)
   */
  function on_click_refresh_glasses() {
    g_recommended_arr = get_personalized_recommended_arr(g_all_glasses_arr)
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
      desc: '오른쪽 목록에서 원하는 안경을 선택해 주세요.\n선택하면 즉시 native AR 피팅 화면이 열립니다.',
      hint: '오른쪽 안경 목록을 확인해 주세요.',
      card_style: 'right: 468px; top: 50%; transform: translateY(-50%)',
    },
    {
      title: 'AR 화면에서 3장을 촬영해 주세요',
      desc: 'AR 화면 하단의 [정면 / 좌측 / 우측] 버튼을 눌러 3장을 찍어 주세요.\n3장을 모두 찍으면 자동으로 AR 화면이 닫힙니다.',
      hint: 'AR 화면 하단 버튼을 사용해 주세요.',
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
</script>

<main class="app-frame-page flex h-full flex-col overflow-hidden bg-white text-zinc-900">
  <Header />

  <div class="flex min-h-0 flex-1 overflow-hidden bg-[var(--retina-text-100)]">
    <!-- 좌측: 카메라 -->
    <section
      class="relative flex min-h-0 flex-1 flex-col transition-[z-index]"
      class:z-50={g_highlight_camera}
    >
      <div
        bind:this={ref_camera_section_el}
        class="arfitting-camera-fill relative min-h-0 flex-1 overflow-hidden bg-zinc-950 shadow-inner transition-all"
        class:ring-4={g_highlight_camera}
        class:ring-[var(--retina-primary-200)]={g_highlight_camera}
        class:ring-offset-4={g_highlight_camera}
      >
        <!-- native AR 이 화면을 takeover 하므로 이 영역은 안내 placeholder 만 표시한다. -->
        <div class="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <Glasses size={48} class="mb-3 text-white/40" />
          <p class="text-[14px] font-bold text-white/85">
            {g_selected_id === null
              ? '오른쪽 목록에서 안경을 선택하면 AR 피팅이 시작됩니다'
              : g_flutter_launch_loading
                ? 'AR 피팅 화면을 여는 중...'
                : 'AR 화면에서 정면 → 좌측 → 우측 순서로 촬영해주세요'}
          </p>
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
                안경 선택 시 AR 피팅이 시작됩니다
              </span>
            </div>
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
                    : 'border-dashed border-slate-300 bg-slate-50'
                }`}
              >
                {#if slot}
                  <img
                    src={slot.object_url}
                    alt={SLOT_LABEL_ARR[idx]}
                    class="h-full w-full rounded-lg object-contain"
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
            onclick={on_click_refresh_glasses}
            class="flex items-center gap-0.5 rounded-md border border-[var(--retina-primary-500)] bg-white px-1.5 py-0.5 text-[9px] font-bold text-[var(--retina-primary-500)] transition-colors hover:bg-[var(--retina-bg-1)]"
          >
            <RefreshCw size={9} />
            <span>프레임 변경</span>
            {#if g_active_filter_count > 0}
              <span
                class="flex h-3 w-3 items-center justify-center rounded-full bg-[var(--retina-primary-300)] text-[8px] font-black text-white"
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
                      >{item.brand}</span
                    >
                    <div class="mt-0.5 flex items-center justify-between gap-1.5">
                      <span class="text-[11px] font-extrabold text-[var(--retina-primary-300)]"
                        >{format_price_label(item.price)}</span
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
