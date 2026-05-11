package com.example.virtualfitting.arcore.assets

import android.content.Context
import android.util.Log
import com.example.virtualfitting.arcore.contract.AssetSource
import com.example.virtualfitting.arcore.contract.ErrorCode
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

private const val TAG = "AssetResolver"

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

        // 캐시 hit 검증: 기존엔 `length > 0` 만 봤는데 그러면 도중에 잘려 손상된 파일이 영구히
        // 재사용됨. 이제 GLB 헤더의 declared length 와 실제 length 가 일치하는지까지 본다.
        if (localTargetFile.exists() && isValidGlbFile(localTargetFile)) {
            Log.i(TAG, "cache hit for $localFileName (size=${localTargetFile.length()})")
            return localTargetFile
        }
        // 손상된 캐시는 즉시 제거. 안 그러면 다음 시도에서도 또 손상 파일이 캐시 hit 으로 잡힘.
        if (localTargetFile.exists()) {
            Log.w(TAG, "corrupted cache for $localFileName, deleting (size=${localTargetFile.length()})")
            localTargetFile.delete()
        }

        // 다운로드는 .partial 임시 파일에 받고 완료된 뒤에만 atomic rename. partial 이 이미
        // 있으면 resume (HTTP Range) 으로 이어받음. 이전 시도(2026-05-11)에서 partial 을
        // 무조건 삭제했더니, 다운로드가 cancel 되고 자동 재시도될 때마다 처음부터 다시 받아
        // 60MB 모델이 영영 완료되지 않았음.
        val localPartialFile = File(localCacheDir, "$localFileName.partial")
        val localResumeOffset = if (localPartialFile.exists()) localPartialFile.length() else 0L
        if (localResumeOffset > 0L) {
            Log.i(TAG, "resuming download for $localFileName from byte $localResumeOffset")
        } else {
            Log.i(TAG, "starting fresh download for $localFileName from $localModelUrl")
        }

        val localConnection = (URL(localModelUrl).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 15000
            // 큰 GLB (60MB+) 가 느린 네트워크에서도 끊기지 않도록 충분히 큰 readTimeout.
            readTimeout = 120000
            instanceFollowRedirects = true
            source.headers.forEach { (key, value) -> setRequestProperty(key, value) }
            if (localResumeOffset > 0L) {
                // S3 는 Range request 를 지원 → 206 Partial Content 응답.
                setRequestProperty("Range", "bytes=$localResumeOffset-")
            }
        }

        try {
            localConnection.connect()

            val responseCode = localConnection.responseCode
            // 206 = Partial Content (resume 성공), 200 = Full body (서버가 Range 무시했거나
            // partial 이 stale 한 경우 — 어차피 새로 받아야 하니 partial 부터 새로 작성).
            val isResumed = responseCode == 206 && localResumeOffset > 0L
            if (responseCode != 200 && responseCode != 206) {
                throw AssetException(
                    ErrorCode.ASSET_DOWNLOAD_FAILED,
                    "Remote model download failed with status $responseCode",
                )
            }

            // Content-Length: 206 이면 남은 byte 수, 200 이면 전체 파일 크기.
            val responseBodyLength = localConnection.contentLengthLong
            val expectedTotalLength: Long = when {
                isResumed && responseBodyLength > 0 -> localResumeOffset + responseBodyLength
                !isResumed && responseBodyLength > 0 -> responseBodyLength
                else -> -1L
            }
            Log.i(
                TAG,
                "response status=$responseCode resumed=$isResumed resumeOffset=$localResumeOffset" +
                    " responseBodyLength=$responseBodyLength expectedTotal=$expectedTotalLength",
            )

            // 서버가 Range 무시하고 200 으로 응답하면 partial 부터 다시 시작해야 함.
            val openAppend = isResumed
            val startSize = if (openAppend) localResumeOffset else 0L
            var bytesRead = 0L

            localConnection.inputStream.use { inputStream ->
                FileOutputStream(localPartialFile, openAppend).use { outputStream ->
                    val buffer = ByteArray(64 * 1024)
                    var lastLogAt = startSize
                    while (true) {
                        val n = inputStream.read(buffer)
                        if (n < 0) break
                        outputStream.write(buffer, 0, n)
                        bytesRead += n
                        val currentSize = startSize + bytesRead
                        // 5MB 마다 한 번 progress 로그.
                        if (currentSize - lastLogAt >= 5L * 1024 * 1024) {
                            Log.i(TAG, "download progress: $currentSize bytes")
                            lastLogAt = currentSize
                        }
                    }
                }
            }

            val finalSize = localPartialFile.length()
            Log.i(TAG, "download stream ended: bytesRead=$bytesRead finalPartialSize=$finalSize")

            // 응답이 빈 body 인 경우: partial 은 절대 삭제하지 않음. 다음 시도에서 resume 으로
            // 이어받기. 그저 이번 시도가 실패했음을 알림.
            if (bytesRead == 0L && finalSize == 0L) {
                throw AssetException(
                    ErrorCode.ASSET_DOWNLOAD_FAILED,
                    "Empty response body (responseCode=$responseCode); partial preserved for resume",
                )
            }
            if (bytesRead == 0L) {
                // resume 시도였는데 0 byte 추가됨 — 이미 완성됐을 수도 있고, 서버가 빈 응답 줬을 수도.
                // 일단 partial 보존하고 검증 단계로 진행.
                Log.w(TAG, "no bytes added this attempt (resume may have hit end of file)")
            }

            // Content-Length 가 응답에 있으면 그것과 비교 (HTTP-level truncation 검증).
            if (expectedTotalLength > 0 && finalSize != expectedTotalLength) {
                throw AssetException(
                    ErrorCode.ASSET_DOWNLOAD_FAILED,
                    "Downloaded size $finalSize != expected total $expectedTotalLength" +
                        " (resume=$isResumed); partial preserved for resume",
                )
            }

            // GLB 헤더의 declared length 와 실제 파일 크기 비교 (포맷-level 무결성).
            // 실패하면 partial 은 그대로 두고 (resume 으로 다시 시도 가능), 단지 이번 시도만 실패.
            if (!isValidGlbFile(localPartialFile)) {
                throw AssetException(
                    ErrorCode.ASSET_DOWNLOAD_FAILED,
                    "Downloaded GLB failed header validation (size=$finalSize); partial preserved for resume",
                )
            }

            // atomic rename.
            if (!localPartialFile.renameTo(localTargetFile)) {
                throw AssetException(
                    ErrorCode.ASSET_DOWNLOAD_FAILED,
                    "Failed to commit downloaded file to cache",
                )
            }
            Log.i(TAG, "download committed: $localFileName (size=$finalSize)")

            return localTargetFile
        } finally {
            localConnection.disconnect()
        }
    }

    /**
     * GLB 2.0 헤더 검증.
     * 헤더 구조 (little-endian, 총 12 bytes):
     *  - magic: 4 bytes ("glTF")
     *  - version: 4 bytes (uint32, == 2)
     *  - length: 4 bytes (uint32, 전체 파일 길이)
     *
     * 검증 기준: magic + version + (declaredLength <= file.length()).
     * lenient 비교를 쓰는 이유: 실제 S3 의 일부 GLB 파일은 header 선언 길이보다 trailing
     * padding/data 가 약간 더 있음 (관측된 예: 511temple, header 63608184 vs 실제 63871352
     * — 263KB 차이). strict equality (==) 로 검증하면 그런 파일은 영영 통과 못함.
     * truncation 검출은 그대로 작동 — file < declared 면 reject.
     */
    private fun isValidGlbFile(file: File): Boolean {
        if (!file.exists() || file.length() < 12L) return false
        return try {
            java.io.RandomAccessFile(file, "r").use { raf ->
                val magic = ByteArray(4).also { raf.readFully(it) }
                if (magic[0] != 'g'.code.toByte() ||
                    magic[1] != 'l'.code.toByte() ||
                    magic[2] != 'T'.code.toByte() ||
                    magic[3] != 'F'.code.toByte()
                ) {
                    return false
                }
                val version = readUint32Le(raf)
                if (version != 2L) return false
                val declaredLength = readUint32Le(raf)
                declaredLength <= file.length()
            }
        } catch (_: Throwable) {
            false
        }
    }

    private fun readUint32Le(raf: java.io.RandomAccessFile): Long {
        val b0 = raf.read().toLong() and 0xFFL
        val b1 = raf.read().toLong() and 0xFFL
        val b2 = raf.read().toLong() and 0xFFL
        val b3 = raf.read().toLong() and 0xFFL
        return (b3 shl 24) or (b2 shl 16) or (b1 shl 8) or b0
    }
}

class AssetException(val code: ErrorCode, message: String) : RuntimeException(message)
