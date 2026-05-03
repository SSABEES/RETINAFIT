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
