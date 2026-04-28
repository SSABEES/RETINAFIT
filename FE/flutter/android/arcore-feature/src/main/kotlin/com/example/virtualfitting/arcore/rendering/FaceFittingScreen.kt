package com.example.virtualfitting.arcore.rendering

import android.util.Log
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.example.virtualfitting.arcore.assets.AssetException
import com.example.virtualfitting.arcore.assets.DefaultAssetResolver
import com.example.virtualfitting.arcore.assets.ResolvedAsset
import com.example.virtualfitting.arcore.contract.ErrorCode
import com.example.virtualfitting.arcore.contract.VirtualFittingEvent
import com.example.virtualfitting.arcore.contract.VirtualFittingRequest
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
import kotlin.math.sqrt
import io.github.sceneview.node.ModelNode as ModelNodeImpl
import io.github.sceneview.rememberEngine
import io.github.sceneview.rememberMaterialLoader
import io.github.sceneview.rememberModelInstance
import io.github.sceneview.rememberModelLoader

private const val TAG = "FaceFittingScreen"

/**
 * 얼굴 자동 스케일 비율. 안경 GLB 의 max extent 를 `FOREHEAD_LEFT <-> FOREHEAD_RIGHT` 거리의
 * 몇 배로 맞출지.
 *
 * - 1.0 = 이마 폭과 동일
 * - 1.1 = 이마 폭보다 10% 넓게 (실제 안경은 이마 폭보다 살짝 넓은 경우가 많음)
 * - 0.9 = 이마 폭보다 10% 좁게
 *
 * GLB 의 max extent 가 프레임 폭(X) 인지 템플 길이(Z) 인지에 따라 체감이 달라진다. 샘플 GLB
 * 에서 안경이 너무 넓어 보이면 줄이고, 좁아 보이면 늘린다.
 */
private const val FACE_WIDTH_RATIO = 2.1f

/**
 * yaw (좌우 회전각, degrees) 가 이 값을 넘으면 반대편 temple 을 hide.
 *
 * 양수 yaw = 착용자가 자기 왼쪽으로 고개 돌림 → `temple_left` (착용자 왼쪽 다리) 가 머리 뒤로
 * 돌아가므로 hide 한다.
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
        StatusOverlay(
            title = "Face Fitting · ${request.product.productName}",
            faceCount = 0,
            statusMessage = "Downloading model...",
            modifier = Modifier
                .fillMaxSize()
                .padding(top = 24.dp, start = 16.dp, end = 16.dp),
        )
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
    val modelInstance = rememberModelInstance(modelLoader, localAssetPath)
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
                    // 첫 프레임에 scaleToUnits 로 세팅된 baseline scale 캡처.
                    if (baseScale == null) baseScale = node.scale

                    // 얼굴 폭 = 좌/우 이마 region 의 월드 공간 유클리드 거리 (meter).
                    val leftPose = face.getRegionPose(
                        AugmentedFace.RegionType.FOREHEAD_LEFT
                    )
                    val rightPose = face.getRegionPose(
                        AugmentedFace.RegionType.FOREHEAD_RIGHT
                    )
                    val dx = leftPose.tx() - rightPose.tx()
                    val dy = leftPose.ty() - rightPose.ty()
                    val dz = leftPose.tz() - rightPose.tz()
                    val faceWidth = sqrt(dx * dx + dy * dy + dz * dz)

                    // baseline: scaleToUnits 로 glasses max extent 가 preset.scaleToUnits (meter).
                    // 여기에 (faceWidth * FACE_WIDTH_RATIO / baselineExtent) 를 곱하면
                    // glasses max extent 가 faceWidth * FACE_WIDTH_RATIO 로 맞춰진다.
                    baseScale?.let { base ->
                        val multiplier =
                            (faceWidth * FACE_WIDTH_RATIO) / preset.scaleToUnits
                        node.scale = base * multiplier
                    }

                    // worldTransform = ... 를 직접 세팅하면 scale 이 덮어써지므로,
                    // position/quaternion 만 반영한다.
                    val composed = face.centerPose.transform * localOffset
                    node.position = composed.position
                    node.quaternion = composed.toQuaternion()
                    node.isVisible = true

                    // 분리된 GLB 인 경우, yaw 에 따라 반대편 temple 을 숨김.
                    if (templeEntities.hasTemples) {
                        val yawDeg = computeYawDegrees(face.centerPose)
                        val rm = engine.renderableManager
                        val leftVisible = yawDeg < TEMPLE_HIDE_YAW_DEG
                        val rightVisible = yawDeg > -TEMPLE_HIDE_YAW_DEG
                        // 양수 yaw → 착용자 왼쪽으로 고개 돌림 → temple_left 가 머리 뒤로.
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

        StatusOverlay(
            title = "Face Fitting · ${request.product.productName}",
            faceCount = detectedFaces.size,
            statusMessage = statusMessage,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = 24.dp, start = 16.dp, end = 16.dp),
        )
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
