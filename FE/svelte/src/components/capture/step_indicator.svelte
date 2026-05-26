<script>
  import { CircleCheck } from 'lucide-svelte'

  /**
   * @typedef {import('@/lib/capture/step_config.js').StepConfig} StepConfig
   */

  /** @type {{
   *   steps_arr?: StepConfig[],
   *   current_index?: number,
   * }}
   */
  let { steps_arr = [], current_index = 0 } = $props()

  // pose_type 코드 → 한글 각도 라벨 매핑.
  const POSE_LABEL_OBJ = {
    front: '정면',
    left_profile: '좌측',
    right_profile: '우측',
  }

  // 스텝의 pose_type 에 해당하는 짧은 한글 라벨을 반환한다.
  function get_angle_label(pose_type) {
    return POSE_LABEL_OBJ[pose_type] ?? ''
  }
</script>

<nav
  class="flex flex-col gap-0.5 border-b border-[var(--retina-text-200)] pb-2"
  aria-label="촬영 진행도"
>
  <h3 class="m-0 mt-2 text-center text-sm font-extrabold text-[var(--retina-text-800)]">
    촬영 단계
  </h3>
  {#each steps_arr as step, i (step.step_id)}
    {@const is_done = i < current_index}
    {@const is_current = i === current_index}
    {@const is_active = is_done || is_current}
    <div
      class={`flex items-center justify-start gap-2 rounded-lg px-2 py-1 text-left transition ${
        is_current ? 'bg-[var(--retina-primary-100)]' : 'bg-transparent'
      }`}
      aria-current={is_current ? 'step' : undefined}
    >
      <span
        class={`grid h-5 w-5 flex-none place-items-center rounded-full text-[10px] font-extrabold tabular-nums transition ${
          is_active
            ? 'bg-[var(--retina-primary-400)] text-[var(--retina-text-100)]'
            : 'bg-[var(--retina-text-200)] text-[var(--retina-text-500)]'
        }`}
        aria-hidden="true"
      >
        {i + 1}
      </span>
      <span
        class={`text-left text-[11px] font-bold leading-tight ${
          is_active ? 'text-[var(--retina-primary-400)]' : 'text-[var(--retina-text-500)]'
        }`}
      >
        Step {i + 1}. {get_angle_label(step.pose_type)}
      </span>
      <CircleCheck
        size={16}
        strokeWidth={2}
        class={`ml-auto flex-none transition ${
          is_active ? 'text-[var(--retina-primary-400)]' : 'text-[var(--retina-text-300)]'
        }`}
        aria-hidden="true"
      />
    </div>
  {/each}
</nav>
