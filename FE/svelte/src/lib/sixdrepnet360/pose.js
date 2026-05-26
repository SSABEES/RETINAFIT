/**
 * 6DRepNet360 출력 회전행렬을 Euler 각도(yaw/pitch/roll)로 변환한다.
 *
 * 모델 forward 가 6D → 3×3 회전행렬까지 처리하므로 브라우저에서는 단순히 atan2 추출만 하면 된다.
 *
 * 컨벤션은 6DRepNet 원본 utils.compute_euler_angles_from_rotation_matrices 와 동일:
 *   pitch = atan2(R[2,1], R[2,2])             (X 축 회전)
 *   yaw   = atan2(-R[2,0], sqrt(R[0,0]² + R[1,0]²))  (Y 축 회전)
 *   roll  = atan2(R[1,0], R[0,0])             (Z 축 회전)
 *
 * gimbal lock(특이점)은 sqrt 항이 0 에 가까울 때 발생하지만 정상적인 머리 자세에서는 거의
 * 도달하지 않으므로 별도 분기 없이 일반식 그대로 사용.
 */

const RAD = 180 / Math.PI

/**
 * @typedef {object} EulerDeg
 * @property {number} yaw    좌우 회전(도). 머리를 오른쪽으로 돌리면 양수.
 * @property {number} pitch  상하 회전(도). 턱을 들면 양수.
 * @property {number} roll   기울기(도). 오른쪽으로 기울면 양수.
 */

/**
 * 3×3 회전행렬(row-major Float32Array(9))을 Euler 각도(도)로 변환한다.
 * @param {Float32Array | number[]} R  R[0..8] = [R00, R01, R02, R10, R11, R12, R20, R21, R22]
 * @returns {EulerDeg}
 */
export function rotation_matrix_to_euler(R) {
  const sy = Math.sqrt(R[0] * R[0] + R[3] * R[3])
  const pitch = Math.atan2(R[7], R[8]) * RAD
  const yaw = Math.atan2(-R[6], sy) * RAD
  const roll = Math.atan2(R[3], R[0]) * RAD
  return { yaw, pitch, roll }
}

/**
 * 머리 위쪽 방향이 이미지 평면(카메라 미러링 화면)에서 수직(캔버스 위)과 이루는 각도 (도, 부호 있음).
 *
 * Euler 분해(rotation_matrix_to_euler)는 yaw≈±90°(측면 캡처) 에서 gimbal lock 으로 pitch 가
 * ±180° 부근으로 튄다. 그러나 측면 측정에 정작 필요한 정보는 "이미지 평면 안에서 머리가 얼마나
 * 기울어졌나" 한 값이라, 회전행렬에서 직접 사영해 뽑으면 분해를 거치지 않아 특이점에서도 안정적이다.
 *
 * 좌표계 (camera_view.svelte 의 project_cube 와 동일):
 *   - 카메라/머리 좌표계 모두 x=right, y=down, z=out-of-screen
 *   - 머리 위쪽 = 머리 좌표 (0, -1, 0)
 *   - 카메라 좌표로: R·(0,-1,0) = (-R[1], -R[4], -R[7])
 *   - 모델은 unmirrored raw 프레임 기준 R 을 출력. 측정값은 R 자체에서 추출 (시각화 미러링과 무관).
 *   - 캔버스 위 사영은 cx - vx 식 (project_cube 참조) — 캔버스 scaleX(-1) 와 결합해 사용자 perception
 *     과 일치. 우리 식은 사영을 거치지 않고 R 원소를 직접 보므로 그 부분 영향 없음.
 *   - 부호 있는 각도 = atan2(R[1], R[4]). 정자세(R = I) 에서 0°, 측면 + pitch 자세에서 정확히 pitch 값.
 *
 * 정자세(R = I): R[1]=0, R[4]=1 → 0°.
 * 머리가 캔버스에서 시계방향으로 기울어 보이면 양수, 반시계는 음수.
 *
 * 좌·우 측면에서는 카메라 방향이 반대라 같은 머리 자세도 부호가 뒤집혀 나온다 — 측정값으로 사용할
 * 때 view 별 부호 보정은 호출측에서 책임진다.
 *
 * @param {Float32Array | number[]} R 9요소 회전행렬
 * @returns {number} -180 ~ 180. 머리가 똑바로 = 0.
 */
export function image_plane_tilt_deg(R) {
  return Math.atan2(R[1], R[4]) * RAD
}
