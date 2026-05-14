package com.example.virtualfitting.arcore.fitting

import com.example.virtualfitting.arcore.contract.FittingConfig
import io.github.sceneview.math.Position
import io.github.sceneview.math.Rotation

/**
 * 안경 GLB 의 기본 프리셋(샘플 모델용).
 *
 * Augmented Faces 좌표계: 원점 = 코 뒤, Z+ = 코 방향 forward, Y+ = 위, X+ = 왼쪽. meter 단위.
 * 모델마다 origin/scale 이 다르므로 per-product 로 override 가능하도록 `FittingConfig.scale`
 * 및 offset/rotation 필드로 추가 보정이 들어간다.
 */
private val defaultPreset = FaceFitPreset(
    scaleToUnits = 0.16f,
    // y/z 튜닝 이력 (511temple 기준):
    //  - y: 0.095 → 0.0988: 노즈패드 기준 보정 전환 (코끝→콧대 anchor 이동 3.8mm 흡수).
    //  - y: 0.0988 → 0.1012: 2026-05-14 runtime tuning UI 로 본인 얼굴 fit 미세조정 검증.
    //  - z: -0.08 → -0.0889: 2026-05-14 같은 tuning. 안경을 살짝 뒤로 (얼굴에 더 가깝게).
    localPosition = Position(x = 0.074f, y = 0.1012f, z = -0.0889f),
    localRotation = Rotation(x = 0f, y = 0f, z = 0.8f),
)

fun FittingConfig.toPreset(base: FaceFitPreset = defaultPreset): FaceFitPreset = FaceFitPreset(
    scaleToUnits = base.scaleToUnits * scale,
    localPosition = Position(
        x = base.localPosition.x + offsetX,
        y = base.localPosition.y + offsetY,
        z = base.localPosition.z + offsetZ,
    ),
    localRotation = Rotation(
        x = base.localRotation.x + rotationX,
        y = base.localRotation.y + rotationY,
        z = base.localRotation.z + rotationZ,
    ),
)

/**
 * 안경 GLB 의 폭 = 얼굴 폭 × 이 비율. GLB 모델 자체의 속성이지 사용자별 차이가 아니다.
 * 샘플 GLB 기준으로 1.0 = 이마 폭 동일, 2.04 = 안경이 이마 폭보다 약 2배.
 * 다른 GLB 로 바뀌면 이 값도 재튜닝 필요 (후속: per-glasses FittingConfig override).
 */
private const val FACE_WIDTH_TO_GLASSES_RATIO: Float = 2.04f

/**
 * [IPD_CORRECTION] 안경 폭 보정을 IPD (동공 간 거리) 기준으로 전환할지 토글.
 * - false: 이마 폭(faceWidth) × FACE_WIDTH_TO_GLASSES_RATIO 사용 (기존 동작)
 * - true:  IPD × IPD_TO_GLASSES_RATIO 사용 (안경 산업 표준 PD 와 동일 개념)
 *
 * IPD 는 이마 폭과 달리 안경 fitting 의 직접 지표라 사용자별 (이마 좁/넓, 동공 간격
 * 좁/넓 비대칭) fitting 정밀도가 더 좋아질 가능성이 있다.
 *
 * IPD_TO_GLASSES_RATIO 가 본인 얼굴에서 동일 효과 나오도록 calibration 되어 있어 본인
 * 얼굴 회귀는 안전. 다른 사용자에서 IPD 와 이마 폭 비율이 본인과 다르면 fitting 결과 차이.
 */
private const val IPD_CORRECTION_ENABLED: Boolean = true

/**
 * 안경 GLB 폭 = IPD × 이 비율. 본인 얼굴 calibration 결과로 결정 — 본인 얼굴에서 IPD 모드와
 * faceWidth 모드가 같은 newScaleToUnits 를 만들어내도록 역산:
 *   ratio = (faceWidth × FACE_WIDTH_TO_GLASSES_RATIO) / IPD
 *         = (0.07295 × 2.04) / 0.06306
 *         ≈ 2.36
 * 다른 GLB 사용 시 재튜닝 필요.
 */
private const val IPD_TO_GLASSES_RATIO: Float = 2.36f

/**
 * 개발자(나) 의 얼굴 IPD 측정값 (m). IPD_CORRECTION_ENABLED=true 일 때 본 사용자 IPD 와의
 * 차이로 안경 폭 추가 보정 가능 (현재는 단순 IPD × 비율 로 사용, REFERENCE 차이 보정은
 * 추후 도입 시 활용).
 *
 * 측정 절차: AR fitting 진입 + calibration lock → logcat 의 "[fit-ref] ... ipd=..." 줄에서
 * 값 옮기기.
 */
const val REFERENCE_IPD: Float = 0.06306f  // 2026-05-15 측정 (개발자 얼굴)

/**
 * defaultPreset.localPosition (x, z) 가 튜닝됐을 때의 RATIO. GLB pivot 보정 좌표가 이 RATIO
 * 기준으로 베이크돼 있으므로, 현재 RATIO 가 다르면 비례 보정 필요.
 * RATIO 가 바뀌어도 원래 튜닝의 정합성 유지하기 위함.
 */
private const val POSITION_TUNING_RATIO: Float = 2.04f

/**
 * 개발자(나) 의 얼굴 코끝 Y 측정값. localPosition.y 가 이 코 위치 기준으로 튜닝됨.
 * 다른 사용자의 코 Y 가 이 값보다 크면(아래) 안경도 그만큼 아래로, 작으면(위) 위로 이동.
 *
 * 측정 절차: docs/superpowers/plans/2026-05-07-ar-fitting-per-user-calibration.md Task 7 참조.
 */
const val REFERENCE_NOSE_TIP_Y: Float = -0.008f  // 2026-05-07 측정 (개발자 얼굴, lockedNoseTipY)

/**
 * [NOSE_BRIDGE_FIT] 콧대 정점 (Canonical Face Mesh 인덱스 6, 197, 195) 의 face-local Y/Z 기준
 * 보정으로 전환할지 토글.
 * - false: 기존 코끝 Y 기준 보정 (변화 없음, 100% 회귀 안전)
 * - true:  노즈패드 위치(콧대 중간) face-local Y + 코 깊이 face-local Z 기준 보정
 *
 * 동기: 코끝(noseTipY) 보다 노즈패드(콧대 중간)가 실제 안경이 걸리는 지점에 가깝고, 사용자별
 * 코 깊이(Z) 차이도 반영해야 외국인/콧대 다양한 사용자에 자연스럽게 fitting 된다.
 *
 * REFERENCE_NOSE_BRIDGE_{Y,Z} 가 개발자 본인 얼굴 측정값으로 세팅돼 있어야 본인 회귀 위험 0.
 * lock 직후 logcat 의 "[fit-ref] locked bridgeFaceLocal Y=... Z=..." 줄에서 값 추출.
 */
private const val NOSE_BRIDGE_FIT_CORRECTION_ENABLED: Boolean = true

/**
 * 개발자(나) 의 얼굴 콧대 face-local Y/Z 측정값. NOSE_BRIDGE_FIT_CORRECTION_ENABLED=true 일 때
 * 이 값과의 차이만큼 안경 위치를 보정. 본인 얼굴 fitting 시 diff=0 이라 변화 없음.
 *
 * 측정 절차: AR fitting 진입 후 정면 응시 → calibration lock 되면 logcat 의 "[fit-ref]" 줄에서
 * Y, Z 값을 옮겨 적고 ENABLED=true 로.
 */
const val REFERENCE_NOSE_BRIDGE_Y: Float = 0.01895f  // 2026-05-14 측정 (개발자 얼굴, lockedBridgeFaceLocalY)
const val REFERENCE_NOSE_BRIDGE_Z: Float = 0.06111f  // 2026-05-14 측정 (개발자 얼굴, lockedBridgeFaceLocalZ)

/**
 * lock 된 measurement 로 preset 보정.
 * - scaleToUnits: 측정한 얼굴 폭 × FACE_WIDTH_TO_GLASSES_RATIO 로 절대 산출
 *   (사용자 얼굴 폭 그대로 반영 — 좁은 얼굴엔 작은 안경, 넓은 얼굴엔 큰 안경)
 * - localPosition.x: GLB pivot 의 좌우 비대칭 보정값 → 모델 스케일과 비례 보정.
 * - localPosition.y: 얼굴-로컬 위치 spec (스케일 무관) + REFERENCE_NOSE_TIP_Y 대비 코 Y 보정.
 * - localPosition.z: 안경이 코 앞에 위치하는 깊이 spec (스케일 무관) → 그대로.
 * - rotation: 그대로.
 */
fun FaceFitPreset.withCalibration(locked: FaceMeasurement): FaceFitPreset {
    // [IPD_CORRECTION] 토글에 따라 안경 폭 보정 소스 분기.
    val newScaleToUnits = if (IPD_CORRECTION_ENABLED && locked.ipd > 0f) {
        locked.ipd * IPD_TO_GLASSES_RATIO
    } else {
        locked.faceWidth * FACE_WIDTH_TO_GLASSES_RATIO
    }
    // pivotScaleRatio: GLB pivot 의 X 보정값을 새 scale 비례로 조정. IPD/faceWidth 비율 차이는
    // 사용자별 ~수 % 수준이라 IPD 모드에서도 기존 비율 유지해도 시각적 차이 미세.
    val pivotScaleRatio = FACE_WIDTH_TO_GLASSES_RATIO / POSITION_TUNING_RATIO
    // [NOSE_BRIDGE_FIT] 토글에 따라 y/z 보정 소스 분기. 본인 얼굴엔 REFERENCE 정확 측정 시 diff=0.
    val yCorrection: Float
    val zCorrection: Float
    if (NOSE_BRIDGE_FIT_CORRECTION_ENABLED) {
        yCorrection = locked.noseBridgeFaceLocalY - REFERENCE_NOSE_BRIDGE_Y
        zCorrection = locked.noseBridgeFaceLocalZ - REFERENCE_NOSE_BRIDGE_Z
    } else {
        yCorrection = locked.noseTipY - REFERENCE_NOSE_TIP_Y
        zCorrection = 0f
    }
    return copy(
        scaleToUnits = newScaleToUnits,
        localPosition = Position(
            x = localPosition.x * pivotScaleRatio,
            y = localPosition.y + yCorrection,
            z = localPosition.z + zCorrection,
        ),
    )
}
