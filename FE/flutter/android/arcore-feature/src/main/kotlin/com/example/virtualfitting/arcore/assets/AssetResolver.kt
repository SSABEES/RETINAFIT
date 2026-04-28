package com.example.virtualfitting.arcore.assets

import android.content.Context
import com.example.virtualfitting.arcore.contract.AssetSource
import com.example.virtualfitting.arcore.contract.ErrorCode
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

sealed interface ResolvedAsset {
    /** Sceneview `rememberModelInstance(modelLoader, assetPath)` 에 바로 전달 가능한 경로. */
    data class LocalAssetPath(val path: String) : ResolvedAsset
}

interface AssetResolver {
    /** 실패 시 contract 의 [ErrorCode] 로 매핑된 예외를 반환한다. */
    fun resolve(source: AssetSource): Result<ResolvedAsset>
}

class DefaultAssetResolver(
    private val context: Context,
) : AssetResolver {

    override fun resolve(source: AssetSource): Result<ResolvedAsset> = when (source) {
        is AssetSource.LocalAsset -> Result.success(ResolvedAsset.LocalAssetPath(source.assetPath))
        is AssetSource.RemoteModel -> runCatching {
            val localFile = downloadRemoteModel(source)
            // Sceneview 의 rememberModelInstance 는 asset 상대경로 또는 file:// URI 만 인식한다.
            // 절대 파일경로 그대로 넘기면 null 로 떨어져서 modelInstance 가 영영 안 만들어진다.
            ResolvedAsset.LocalAssetPath("file://${localFile.absolutePath}")
        }.recoverCatching { throwable ->
            throw when (throwable) {
                is AssetException -> throwable
                else -> {
                    // 디버깅을 위해 throwable 클래스명까지 메시지에 담는다.
                    // (NetworkOnMainThreadException 등은 message 가 null 이라 fallback 만 보이면 원인 파악 불가)
                    val localCauseText = "${throwable.javaClass.simpleName}: ${throwable.message ?: "no message"}"
                    AssetException(ErrorCode.ASSET_DOWNLOAD_FAILED, localCauseText)
                }
            }
        }
    }

    private fun downloadRemoteModel(source: AssetSource.RemoteModel): File {
        val localModelUrl = source.modelUrl.trim()
        if (!localModelUrl.startsWith("http://") && !localModelUrl.startsWith("https://")) {
            throw AssetException(ErrorCode.ASSET_URL_INVALID, "Invalid model URL: $localModelUrl")
        }

        val localFileName = buildString {
            append(source.cacheKey.ifBlank { "remote-model" })
            append(".glb")
        }
        val localCacheDir = File(context.cacheDir, "virtual-fitting-models").apply { mkdirs() }
        val localTargetFile = File(localCacheDir, localFileName)

        if (localTargetFile.exists() && localTargetFile.length() > 0) {
            return localTargetFile
        }

        val localConnection = (URL(localModelUrl).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 15000
            readTimeout = 30000
            instanceFollowRedirects = true
            source.headers.forEach { (key, value) -> setRequestProperty(key, value) }
        }

        try {
            localConnection.connect()

            if (localConnection.responseCode !in 200..299) {
                throw AssetException(
                    ErrorCode.ASSET_DOWNLOAD_FAILED,
                    "Remote model download failed with status ${localConnection.responseCode}",
                )
            }

            localConnection.inputStream.use { inputStream ->
                FileOutputStream(localTargetFile).use { outputStream ->
                    inputStream.copyTo(outputStream)
                }
            }

            if (!localTargetFile.exists() || localTargetFile.length() == 0L) {
                throw AssetException(
                    ErrorCode.ASSET_DOWNLOAD_FAILED,
                    "Downloaded model file is empty",
                )
            }

            return localTargetFile
        } finally {
            localConnection.disconnect()
        }
    }
}

class AssetException(val code: ErrorCode, message: String) : RuntimeException(message)
