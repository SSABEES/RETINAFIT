/**
 * 브라우저의 카메라 권한 상태를 조회한다.
 * Permissions API 미지원 환경(Safari 일부 버전 등)에서는 'unsupported' 를 반환한다.
 * @returns {Promise<'granted' | 'denied' | 'prompt' | 'unsupported'>}
 */
export async function check_camera_permission_state() {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'unsupported'
  }

  try {
    const local_status = await navigator.permissions.query({
      name: /** @type {any} */ ('camera'),
    })
    return /** @type {any} */ (local_status.state)
  } catch {
    return 'unsupported'
  }
}

/**
 * getUserMedia 로 카메라 권한을 요청한다. 트랙을 즉시 닫아 자원 점유를 풀어준다.
 * 권한이 허용되면 true, 거부/오류면 false 를 반환한다.
 * @returns {Promise<boolean>}
 */
export async function request_camera_permission() {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return false
  }

  try {
    const local_stream = await navigator.mediaDevices.getUserMedia({ video: true })
    local_stream.getTracks().forEach((track) => track.stop())
    return true
  } catch {
    return false
  }
}

/**
 * 카메라 권한 상태가 바뀔 때마다 콜백을 호출한다.
 * 사용자가 주소창 자물쇠에서 권한을 허용/차단으로 바꿀 때 새로고침 없이 감지하기 위해 사용한다.
 * 반환값은 구독을 해제하는 함수다.
 * @param {(state: 'granted' | 'denied' | 'prompt') => void} callback
 * @returns {Promise<() => void>}
 */
export async function watch_camera_permission_change(callback) {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return () => {}
  }

  try {
    const local_status = await navigator.permissions.query({
      name: /** @type {any} */ ('camera'),
    })

    const local_handler = () => {
      callback(/** @type {any} */ (local_status.state))
    }

    local_status.addEventListener('change', local_handler)
    return () => local_status.removeEventListener('change', local_handler)
  } catch {
    return () => {}
  }
}
