<script>
  /** @type {{ label?: string, size?: number, show_label?: boolean }} */
  let { label = 'Loading', size = 32, show_label = true } = $props()
</script>

<div
  class="inline-flex items-center gap-3 text-sm font-semibold text-[#EA6A0F]"
  role="status"
  aria-live="polite"
>
  <!--
    LogoSymbol 기반 로딩 스피너.
    - 4개 모서리 브래킷은 정적으로 고정.
    - 가운데 + 형태만 viewBox 정중앙(153, 153) 기준으로 회전 → "스캔" 느낌.
    transform-origin 은 SVG 좌표 기준 픽셀 단위로 지정해야 회전 축이 정확히 중앙으로 잡힌다.
  -->
  <svg
    viewBox="0 0 306 306"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    aria-hidden="true"
  >
    <g>
      <path
        d="M274.615 27.4615C276.782 27.4615 278.538 29.218 278.538 31.3846V82.5H306V31.3846C306 14.0514 291.949 0 274.615 0H230V27.4615H274.615Z"
        fill="#EA6A0F"
      />
      <path
        d="M27.4615 31.3846C27.4615 29.218 29.218 27.4615 31.3846 27.4615H79V0H31.3846C14.0514 0 0 14.0514 0 31.3846V82.5H27.4615V31.3846Z"
        fill="#EA6A0F"
      />
      <path
        d="M27.4615 274.615C27.4615 276.782 29.218 278.538 31.3846 278.538H79V306H31.3846L30.5743 305.989C13.8848 305.567 0.433493 292.115 0.0105356 275.426L0 274.615V221.5H27.4615V274.615Z"
        fill="#EA6A0F"
      />
      <path
        d="M306 274.615C306 291.678 292.384 305.56 275.426 305.989L274.615 306H230V278.538H274.615C276.782 278.538 278.538 276.782 278.538 274.615L279 221.5H306V274.615Z"
        fill="#EA6A0F"
      />
    </g>
    <g class="logo-spinner-plus">
      <path
        d="M153 79C158.523 79 163 83.4772 163 89V118C163 131.807 174.193 143 188 143H217C222.523 143 227 147.477 227 153C227 158.523 222.523 163 217 163H188C174.193 163 163 174.193 163 188V217C163 222.523 158.523 227 153 227C147.477 227 143 222.523 143 217V188C143 174.193 131.807 163 118 163H89C83.4772 163 79 158.523 79 153C79 147.477 83.4772 143 89 143H118C131.807 143 143 131.807 143 118V89C143 83.4772 147.477 79 153 79Z"
        fill="#EA6A0F"
      />
    </g>
  </svg>
  {#if show_label && label}
    <span>{label}</span>
  {/if}
</div>

<style>
  .logo-spinner-plus {
    transform-origin: 153px 153px;
    animation: logo-spinner-rotate 1.2s linear infinite;
  }

  @keyframes logo-spinner-rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* 사용자가 모션 줄이기를 켜면 회전 정지 — 접근성 고려. */
  @media (prefers-reduced-motion: reduce) {
    .logo-spinner-plus {
      animation: none;
    }
  }
</style>
