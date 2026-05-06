<script>
  /**
   * 검출된 ArUco 마커의 corner 와 ID/거리 라벨을 SVG 로 그려주는 오버레이.
   * 측정 캔버스 위에 absolute 로 얹어 사용한다.
   *
   * @typedef {import('@/lib/measurements/aruco_detector.js').DetectedMarker} DetectedMarker
   */

  /** @type {{
   *   markers_arr?: DetectedMarker[],
   *   image_width: number,
   *   image_height: number,
   * }} */
  let { markers_arr = [], image_width, image_height } = $props()
</script>

<svg
  class="pointer-events-none absolute inset-0 h-full w-full"
  viewBox="0 0 {image_width} {image_height}"
  preserveAspectRatio="xMidYMid meet"
  aria-hidden="true"
>
  {#each markers_arr as m (m.id)}
    <polygon
      points={m.corners.map((c) => `${c.x},${c.y}`).join(' ')}
      fill="rgba(0,200,83,0.15)"
      stroke="#00c853"
      stroke-width="3"
    />
    <text
      x={m.corners[0].x}
      y={m.corners[0].y - 6}
      fill="#00c853"
      font-size="20"
      font-weight="700"
    >
      ID {m.id} z={m.translation[2].toFixed(0)}mm
    </text>
  {/each}
</svg>
