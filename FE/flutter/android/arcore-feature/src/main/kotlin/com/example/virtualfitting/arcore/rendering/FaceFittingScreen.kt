package com.example.virtualfitting.arcore.rendering

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.graphics.Bitmap
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.view.PixelCopy
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import java.io.ByteArrayOutputStream
import com.example.virtualfitting.arcore.assets.AssetException
import com.example.virtualfitting.arcore.assets.DefaultAssetResolver
import com.example.virtualfitting.arcore.assets.ResolvedAsset
import com.example.virtualfitting.arcore.contract.ErrorCode
import com.example.virtualfitting.arcore.contract.VirtualFittingEvent
import com.example.virtualfitting.arcore.contract.VirtualFittingRequest
import com.example.virtualfitting.arcore.fitting.FaceCalibration
import com.example.virtualfitting.arcore.fitting.measure
import com.example.virtualfitting.arcore.fitting.withCalibration
import com.example.virtualfitting.arcore.fitting.toPreset
import com.example.virtualfitting.arcore.ui.StatusOverlay
import com.google.android.filament.RenderableManager
import com.google.ar.core.AugmentedFace
import com.google.ar.core.Config
import com.google.ar.core.Pose
import com.google.ar.core.Session
import com.google.ar.core.TrackingState
import io.github.sceneview.SurfaceType
import io.github.sceneview.ar.ARSceneView
import io.github.sceneview.ar.arcore.transform
import io.github.sceneview.ar.node.AugmentedFaceNode as AugmentedFaceNodeImpl
import io.github.sceneview.ar.rememberARCameraNode
import io.github.sceneview.ar.rememberARCameraStream
import dev.romainguy.kotlin.math.rotation
import dev.romainguy.kotlin.math.translation
import io.github.sceneview.math.Position
import io.github.sceneview.math.Scale
import io.github.sceneview.math.Transform
import io.github.sceneview.math.toQuaternion
import io.github.sceneview.node.ModelNode as ModelNodeImpl
import io.github.sceneview.rememberEngine
import io.github.sceneview.rememberMaterialLoader
import io.github.sceneview.rememberModelInstance
import io.github.sceneview.rememberModelLoader

private const val TAG = "FaceFittingScreen"

/**
 * 정면 영역의 너비 (degrees, 양수). |yaw| 가 이 값 이하면 두 다리 모두 hide,
 * 이상이면 카메라를 향한 한쪽 다리만 show.
 *
 * 양수 yaw = 착용자가 자기 왼쪽으로 고개 돌림 → 카메라엔 우측 얼굴이 더 보임 →
 * `temple_right` show, `temple_left` hide. 정면(|yaw| ≤ 임계값) 에선 두 다리 모두
 * 머리 뒤에 가려져야 자연스러우므로 hide.
 */
private const val TEMPLE_HIDE_YAW_DEG = 5f

/**
 * 전면 카메라 + Augmented Faces + GLB 안경 렌더링의 핵심 Composable.
 *
 * 구현 노트: `AugmentedFaceNode` + 부모 연결 패턴이 현재 Sceneview 4.0.1 에서 동작하지 않아,
 * ModelNode 를 scene root 에 두고 onSessionUpdated 에서 매 프레임 worldTransform 을 직접
 * 세팅한다. 얼굴이 트래킹되지 않으면 `isVisible = false` 로 숨긴다.
 */
@Composable
fun FaceFittingScreen(
    request: VirtualFittingRequest,
    emit: (VirtualFittingEvent) -> Unit,
    onClose: () -> Unit,
) {
    val requestId = request.session.requestId
    val preset = remember(request.fitting) { request.fitting.toPreset() }

    val context = LocalContext.current
    // RemoteModel 은 HTTP 다운로드가 필요하므로 IO 디스패처에서 resolve.
    // 메인 스레드에서 직접 호출하면 NetworkOnMainThreadException 으로 터진다.
    val resolution by produceState<Result<ResolvedAsset>?>(
        initialValue = null,
        request.asset,
        context,
    ) {
        value = withContext(Dispatchers.IO) {
            DefaultAssetResolver(context).resolve(request.asset)
        }
    }

    if (resolution == null) {
        // 모델 로딩 중에는 별도 안내 오버레이 없이 빈 화면을 잠깐 보여준다.
        return
    }

    val resolved = resolution!!.getOrNull()

    if (resolved == null) {
        val error = resolution!!.exceptionOrNull()
        val code = (error as? AssetException)?.code ?: ErrorCode.ASSET_URL_INVALID
        emit(
            VirtualFittingEvent.Error(
                requestId = requestId,
                code = code,
                message = error?.message,
            )
        )
        onClose()
        return
    }

    val localAssetPath = (resolved as ResolvedAsset.LocalAssetPath).path

    val engine = rememberEngine()
    val modelLoader = rememberModelLoader(engine)
    val materialLoader = rememberMaterialLoader(engine)
    val cameraStream = rememberARCameraStream(materialLoader)
    // sceneview 4.0.1 의 rememberModelInstance 는 asset 상대경로만 지원 (file:// / 절대경로 미지원).
    // 따라서 RemoteModel 로 다운로드된 파일 (file://...) 의 경우엔 직접 ByteBuffer 로 읽어서
    // modelLoader.createModelInstance(buffer) 에 넘긴다. asset 경로면 기존 경로 그대로 사용.
    val modelInstance: io.github.sceneview.model.ModelInstance? by androidx.compose.runtime.produceState<io.github.sceneview.model.ModelInstance?>(
        initialValue = null,
        key1 = modelLoader,
        key2 = localAssetPath,
    ) {
        // 바이트 읽기는 IO, Filament createModelInstance 는 Main 에서.
        // (Filament Engine 이 채택한 스레드에서만 createModelInstance 호출 가능 — 안 그러면
        // "This thread has not been adopted" panic → SIGABRT.)
        value = runCatching {
            val bytes = withContext(kotlinx.coroutines.Dispatchers.IO) {
                when {
                    localAssetPath.startsWith("file://") -> {
                        java.io.File(localAssetPath.removePrefix("file://")).readBytes()
                    }
                    localAssetPath.startsWith("/") -> {
                        java.io.File(localAssetPath).readBytes()
                    }
                    else -> {
                        // asset 상대경로
                        context.assets.open(localAssetPath).use { it.readBytes() }
                    }
                }
            }
            modelLoader.createModelInstance(java.nio.ByteBuffer.wrap(bytes))
        }.onFailure {
            Log.e(TAG, "Failed to load model from $localAssetPath", it)
        }.getOrNull()
    }
    val arCameraNode = rememberARCameraNode(engine)

    // arsceneview AAR 이 번들한 depth-only unlit 재질. 얼굴 메쉬를 이 재질로 그리면 색은 쓰지
    // 않고 depth 만 써서, 뒤쪽(얼굴 뒤) 에 있는 안경 다리 픽셀이 depth test 에 걸려 사라진다.
    val faceOccluderInstance = remember(materialLoader) {
        val material = materialLoader.createMaterial("materials/face_mesh_occluder.filamat")
        materialLoader.createInstance(material)
    }

    // 스케일을 덮어쓰지 않기 위해 translation + rotation 만 담는다.
    // 스케일은 ModelNode 의 scaleToUnits 가 세팅한 값이 유지된다.
    val localOffset = remember(preset) {
        translation(preset.localPosition) * rotation(preset.localRotation.toQuaternion())
    }

    // 분리된 GLB(`front` / `temple_left` / `temple_right`) 의 노드 entity 를 이름으로 조회.
    // 단일 mesh GLB 면 leftEntity/rightEntity 가 0 으로 잡혀서 selective hide 를 건너뛴다.
    val templeEntities = remember(modelInstance) {
        val mi = modelInstance
        if (mi == null) {
            TempleEntities.EMPTY
        } else {
            TempleEntities(
                left = mi.asset.getFirstEntityByName("temple_left"),
                right = mi.asset.getFirstEntityByName("temple_right"),
            )
        }
    }

    var glassesNode by remember { mutableStateOf<ModelNodeImpl?>(null) }
    // scaleToUnits 로 초기 계산된 scale 을 첫 프레임에 캡처. 이후 이를 baseline 으로 얼굴
    // 폭에 맞춰 multiplier 를 곱한다.
    var baseScale by remember { mutableStateOf<Scale?>(null) }
    val calibration = remember { FaceCalibration() }
    var appliedPostLock by remember { mutableStateOf(false) }
    // 디버그: 현재 yaw 와 temple 가시성을 status overlay 에 표시.
    var debugYawDeg by remember { mutableStateOf(0f) }
    var debugLeftVisible by remember { mutableStateOf(true) }
    var debugRightVisible by remember { mutableStateOf(true) }
    // AugmentedFaceNode 참조 — 첫 트래킹 프레임에 생성되는 meshNode 에 priority(0) 을 걸어
    // 안경보다 먼저 렌더되도록 하기 위해 필요하다.
    var faceNodeImpl by remember { mutableStateOf<AugmentedFaceNodeImpl?>(null) }
    var occluderPrioritized by remember { mutableStateOf(false) }
    var detectedFaces by remember { mutableStateOf<List<AugmentedFace>>(emptyList()) }
    var statusMessage by remember { mutableStateOf("Initializing ARCore...") }
    var trackingReported by remember { mutableStateOf(false) }
    var startedReported by remember { mutableStateOf(false) }
    // 캡처 직전에 true 로 바꿔서 status overlay / 캡처 버튼이 결과 이미지에 찍히지 않게 한다.
    var hide_overlay_during_capture by remember { mutableStateOf(false) }

    Box(modifier = Modifier.fillMaxSize()) {
        ARSceneView(
            modifier = Modifier.fillMaxSize(),
            surfaceType = SurfaceType.TextureSurface,
            engine = engine,
            modelLoader = modelLoader,
            materialLoader = materialLoader,
            cameraStream = cameraStream,
            cameraNode = arCameraNode,
            planeRenderer = false,
            sessionFeatures = setOf(Session.Feature.FRONT_CAMERA),
            sessionConfiguration = { _, config ->
                config.augmentedFaceMode = Config.AugmentedFaceMode.MESH3D
                config.planeFindingMode = Config.PlaneFindingMode.DISABLED
                config.lightEstimationMode = Config.LightEstimationMode.DISABLED
            },
            onSessionCreated = {
                if (!startedReported) {
                    startedReported = true
                    emit(VirtualFittingEvent.Started(requestId))
                }
                statusMessage = if (modelInstance == null) {
                    "ARCore ready. Loading GLB..."
                } else {
                    "ARCore ready. Point the front camera at a face."
                }
            },
            onSessionFailed = { exception ->
                Log.e(TAG, "Failed to start AR session", exception)
                statusMessage = "AR session failed: ${exception.message ?: "unknown error"}"
                emit(
                    VirtualFittingEvent.Error(
                        requestId = requestId,
                        code = ErrorCode.SESSION_CREATE_FAILED,
                        message = exception.message,
                    )
                )
            },
            onSessionUpdated = { session, _ ->
                val tracking = session.getAllTrackables(AugmentedFace::class.java)
                    .filter { it.trackingState == TrackingState.TRACKING }
                if (tracking != detectedFaces) detectedFaces = tracking

                // Face mesh 는 첫 TRACKING 프레임에만 생성된다. 생성된 시점에 priority(0) 으로
                // 세팅해서 다른 opaque (안경 default=4) 보다 먼저 렌더되도록 강제한다. 이게
                // 없으면 Filament 기본 near-to-far 정렬에서 가까운 안경이 먼저 그려지고
                // depth buffer 는 이미 안경 값으로 덮여 있어서 occluder 가 효과가 없다.
                if (!occluderPrioritized) {
                    faceNodeImpl?.meshNode?.let { mesh ->
                        mesh.setPriority(0)
                        occluderPrioritized = true
                        Log.d(TAG, "Occluder priority(0) applied to face mesh: entity=${mesh.entity}")
                    }
                }

                val face = tracking.firstOrNull()
                val node = glassesNode
                if (face != null && node != null) {
                    if (baseScale == null) baseScale = node.scale

                    // 매 프레임 측정 — lock 전엔 누적, lock 후엔 no-op.
                    val m = measure(face)
                    calibration.submit(m, nowMs = System.currentTimeMillis())

                    // lock 시점에 한 번 calibrated preset 적용. 이후엔 ModelNode 의
                    // scale/position 이 그 값을 유지하므로 매 프레임 재적용 불필요.
                    val locked = calibration.locked
                    val activeOffset = if (locked != null) {
                        if (!appliedPostLock) {
                            val calibrated = preset.withCalibration(locked)
                            baseScale?.let { base ->
                                node.scale = base * (calibrated.scaleToUnits / preset.scaleToUnits)
                            }
                            appliedPostLock = true
                        }
                        translation(preset.withCalibration(locked).localPosition) *
                            rotation(preset.localRotation.toQuaternion())
                    } else {
                        localOffset
                    }

                    val composed = face.centerPose.transform * activeOffset
                    node.position = composed.position
                    node.quaternion = composed.toQuaternion()
                    node.isVisible = true

                    // 분리된 GLB 인 경우, yaw 에 따라 반대편 temple 을 숨김.
                    if (templeEntities.hasTemples) {
                        val yawDeg = computeYawDegrees(face.centerPose)
                        val rm = engine.renderableManager
                        // |yaw| ≤ 임계값: 정면 영역 → 두 다리 모두 hide.
                        // yaw > +임계값: 머리가 좌측으로 돌아 우측 얼굴이 카메라를 향함 → 우 다리만 show.
                        // yaw < -임계값: 머리가 우측으로 돌아 좌측 얼굴이 카메라를 향함 → 좌 다리만 show.
                        val leftVisible = yawDeg < -TEMPLE_HIDE_YAW_DEG
                        val rightVisible = yawDeg > TEMPLE_HIDE_YAW_DEG
                        setEntityVisible(rm, templeEntities.left, leftVisible)
                        setEntityVisible(rm, templeEntities.right, rightVisible)
                        debugYawDeg = yawDeg
                        debugLeftVisible = leftVisible
                        debugRightVisible = rightVisible
                    }
                } else {
                    node?.isVisible = false
                }

                when {
                    modelInstance == null -> {
                        statusMessage = "Loading GLB into renderer..."
                    }
                    tracking.isEmpty() -> {
                        if (trackingReported) {
                            trackingReported = false
                            emit(VirtualFittingEvent.TrackingLost(requestId))
                        }
                        statusMessage = "Point the front camera at a face."
                    }
                    else -> {
                        if (!trackingReported) {
                            trackingReported = true
                            emit(VirtualFittingEvent.TrackingActive(requestId))
                        }
                        statusMessage = if (templeEntities.hasTemples) {
                            "yaw=%+.1f° L=%s R=%s".format(
                                debugYawDeg,
                                if (debugLeftVisible) "ON" else "off",
                                if (debugRightVisible) "ON" else "off",
                            )
                        } else {
                            "GLB attached to ${tracking.size} face(s)."
                        }
                    }
                }
            }
        ) {
            // AugmentedFaceNode 제거: 얼굴 mesh occluder 가 dispose 시 MaterialInstance 와
            // Renderable 의 destroy 순서 race 로 Filament Precondition Panic → SIGABRT 발생.
            // 대신 GLB 노드 (`temple_left` / `temple_right`) 의 yaw-based visibility 토글로
            // 안경 다리 가림 처리. 단일 mesh GLB 의 경우 머리 뒤 temple 이 비치는 시각적
            // 단점이 있으나, 3-part split GLB (스펙 권장) 에서는 이미 충분히 자연스러움.

            // 안경 다리 occlusion 시도 이력 (2026-05-08):
            // 1. AugmentedFaceNode + face_mesh_occluder.filamat → mesh 렌더 자체 안 됨 + dispose race crash
            // 2. visible 머티리얼로 바꿔봐도 face mesh 안 그려짐 → wrapper 가 mesh 데이터 누락 의심
            // 3. SphereNode + visible 머티리얼 → 화면에 sphere 안 그려짐 (logcat 에러 없이 silent fail)
            // 결론: SceneView 4.0.1 의 보조 mesh 렌더 경로가 우리 설정에서 작동 안 함.
            // 다른 경로 (3-part split GLB) 도 GLB 가 photogrammetry 단일 mesh 라 부적합.
            // 정면에서 안경 다리 보이는 것은 알려진 한계로 수용. 후속 작업 후보:
            //  - GLB 를 모델링/CAD 로 재제작해서 3-part split 가능하게
            //  - SceneView 버전 업그레이드 후 재시도

            val instance = modelInstance
            if (instance != null) {
                ModelNode(
                    modelInstance = instance,
                    autoAnimate = false,
                    scaleToUnits = preset.scaleToUnits,
                    centerOrigin = Position(x = 0f, y = 0f, z = 0f),
                    isVisible = false,
                    apply = {
                        glassesNode = this
                        isTouchable = false
                        isEditable = false
                        isShadowCaster = false
                        isShadowReceiver = false
                        setCulling(false)
                    }
                )
            }
        }

        CaptureControls(
            requestId = requestId,
            emit = emit,
            onAllCaptured = onClose,
            on_set_overlay_hidden = { hidden -> hide_overlay_during_capture = hidden },
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 24.dp, start = 16.dp, end = 16.dp)
                .alpha(if (hide_overlay_during_capture) 0f else 1f),
        )
    }
}

private val CAPTURE_SLOT_ARR = listOf(
    "front" to "정면",
    "left" to "좌측",
    "right" to "우측",
)

/**
 * 하단 캡처 컨트롤러. 정면/좌/우 3장을 native 에서 직접 PixelCopy 로 캡처해
 * VirtualFittingEvent.Captured 로 전송하고, 3장이 모두 끝나면 자동으로 닫힌다.
 */
@Composable
private fun CaptureControls(
    requestId: String,
    emit: (com.example.virtualfitting.arcore.contract.VirtualFittingEvent) -> Unit,
    onAllCaptured: () -> Unit,
    on_set_overlay_hidden: (Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }
    val coroutine_scope = rememberCoroutineScope()

    var captured_slot_set by remember { mutableStateOf(setOf<String>()) }
    var capture_in_progress by remember { mutableStateOf(false) }

    // 모든 슬롯이 채워지면 짧게 대기 후 Activity 종료. 마지막 emit 이 dispatcher 에 도달할
    // 시간을 주기 위해 약간의 delay 를 둔다.
    LaunchedEffect(captured_slot_set.size) {
        if (captured_slot_set.size >= CAPTURE_SLOT_ARR.size) {
            delay(400)
            onAllCaptured()
        }
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(Color(0xCC1F1F1F), RoundedCornerShape(16.dp))
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = if (captured_slot_set.size >= CAPTURE_SLOT_ARR.size) {
                "촬영 완료. 잠시 후 닫힙니다..."
            } else {
                "정면 → 좌측 → 우측 순서로 촬영해주세요"
            },
            color = Color.White,
        )
        Spacer(modifier = Modifier.height(10.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            CAPTURE_SLOT_ARR.forEach { (slot_key, slot_label) ->
                val captured = slot_key in captured_slot_set
                Button(
                    onClick = onClick@{
                        if (capture_in_progress || captured || activity == null) return@onClick
                        capture_in_progress = true
                        // overlay/캡처 버튼을 잠깐 alpha 0 으로 만들고, recomposition 이 화면에
                        // 반영된 다음 PixelCopy 를 호출해 결과 이미지에 UI 가 찍히지 않게 한다.
                        coroutine_scope.launch {
                            on_set_overlay_hidden(true)
                            // 두 프레임 정도 (~120ms) 대기. compose draw 가 반영되도록.
                            delay(120)
                            captureWindowToBase64(activity) { base64 ->
                                on_set_overlay_hidden(false)
                                capture_in_progress = false
                                if (base64 != null) {
                                    emit(
                                        com.example.virtualfitting.arcore.contract.VirtualFittingEvent.Captured(
                                            requestId = requestId,
                                            slot = slot_key,
                                            imageBase64 = base64,
                                        )
                                    )
                                    captured_slot_set = captured_slot_set + slot_key
                                }
                            }
                        }
                    },
                    enabled = !captured && !capture_in_progress,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (captured) Color(0xFF4CAF50) else Color(0xFFF97316),
                        disabledContainerColor = Color(0xFF4CAF50),
                    ),
                ) {
                    Text(if (captured) "$slot_label ✓" else slot_label)
                }
            }
        }
    }
}

/** Compose 내부에서 받는 Context 가 ContextWrapper 일 수 있어 Activity 까지 언랩한다. */
private fun Context.findActivity(): Activity? {
    var ctx: Context = this
    while (ctx is ContextWrapper) {
        if (ctx is Activity) return ctx
        ctx = ctx.baseContext
    }
    return null
}

/**
 * Activity 의 Window 전체를 PixelCopy 로 비트맵에 복사하고 JPEG base64 로 인코딩한다.
 * ARCore + Filament 가 hardware accelerated 로 그리므로 View.draw 로는 픽셀이 안 잡힌다.
 */
private fun captureWindowToBase64(activity: Activity, callback: (String?) -> Unit) {
    val window = activity.window
    val decor_view = window.decorView
    val width = decor_view.width
    val height = decor_view.height
    if (width <= 0 || height <= 0) {
        Log.w("FaceFittingScreen", "captureWindowToBase64: invalid view size $width x $height")
        callback(null)
        return
    }

    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val handler = Handler(Looper.getMainLooper())
    try {
        PixelCopy.request(window, bitmap, { result ->
            try {
                if (result == PixelCopy.SUCCESS) {
                    val baos = ByteArrayOutputStream()
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 85, baos)
                    val base64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP)
                    callback(base64)
                } else {
                    Log.w("FaceFittingScreen", "PixelCopy failed: $result")
                    callback(null)
                }
            } finally {
                bitmap.recycle()
            }
        }, handler)
    } catch (t: Throwable) {
        Log.e("FaceFittingScreen", "PixelCopy.request threw", t)
        bitmap.recycle()
        callback(null)
    }
}

/** 분리 GLB 의 좌/우 temple entity. 0 = 해당 이름의 노드 없음. */
private data class TempleEntities(val left: Int, val right: Int) {
    val hasTemples: Boolean get() = left != 0 && right != 0

    companion object {
        val EMPTY = TempleEntities(left = 0, right = 0)
    }
}

/**
 * face.centerPose 의 quaternion 에서 yaw (Y축 회전, degrees) 추출.
 * 양수 = 착용자 왼쪽으로 고개 돌림. 음수 = 오른쪽.
 */
private fun computeYawDegrees(pose: Pose): Float {
    val qx = pose.qx()
    val qy = pose.qy()
    val qz = pose.qz()
    val qw = pose.qw()
    val sinY = 2f * (qw * qy + qz * qx)
    val cosY = 1f - 2f * (qx * qx + qy * qy)
    return (kotlin.math.atan2(sinY, cosY) * 180f / kotlin.math.PI.toFloat())
}

/** Filament entity 의 layer mask 로 가시성 토글. entity == 0 이면 no-op. */
private fun setEntityVisible(rm: RenderableManager, entity: Int, visible: Boolean) {
    if (entity == 0) return
    val instance = rm.getInstance(entity)
    if (instance == 0) return
    rm.setLayerMask(instance, 0xff, if (visible) 0xff else 0x00)
}
