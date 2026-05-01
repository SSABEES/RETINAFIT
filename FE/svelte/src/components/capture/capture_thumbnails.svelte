<script>
  import { get_session } from '@/lib/stores/capture_session.svelte.js'

  const g_session = $derived(get_session())

  // pose_type → 비어있는 슬롯에 표시할 한글 라벨/아이콘 매핑.
  const POSE_PLACEHOLDER_OBJ = {
    front: { label: '정면', icon: '/icons/face_center.png' },
    left_profile: { label: '좌측', icon: '/icons/face_left.png' },
    right_profile: { label: '우측', icon: '/icons/face_right.png' },
  }

  // 스텝의 pose_type 에 해당하는 비어있는 슬롯 안내 정보를 반환한다.
  function get_placeholder_obj(pose_type) {
    return POSE_PLACEHOLDER_OBJ[pose_type] ?? { label: '', icon: '' }
  }
</script>

<div class="flex flex-col gap-1.5">
  <div class="text-center mt-2 text-sm font-extrabold text-[var(--retina-text-800)]">촬영 기록</div>
  <div class="grid grid-cols-3 gap-1.5">
    {#each g_session.steps_arr as step, i (step.step_id)}
      {@const capture = g_session.captures_obj[step.step_id]}
      {@const placeholder = get_placeholder_obj(step.pose_type)}
      <div
        class="relative aspect-[3/4] overflow-hidden rounded-md bg-[var(--retina-text-200)]"
        aria-label="Step {i + 1} {capture ? '촬영 완료' : '미촬영'}"
      >
        {#if capture}
          <img src={capture.object_url} alt={step.label} class="h-full w-full object-cover" />
          <span
            class="absolute left-1 top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-[var(--retina-primary-600)] text-[8px] font-extrabold text-[var(--retina-text-100)]"
            aria-hidden="true"
          >
            ✓
          </span>
        {:else}
          <div class="grid h-full w-full place-items-center" aria-hidden="true">
            <div class="flex flex-col items-center gap-0.5">
              <img src={placeholder.icon} alt="" class="h-3.5 w-auto" />
              <span class="text-[10px] font-bold text-[var(--retina-text-400)]">
                {placeholder.label}
              </span>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>
