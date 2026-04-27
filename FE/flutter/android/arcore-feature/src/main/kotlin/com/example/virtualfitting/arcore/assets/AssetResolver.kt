package com.example.virtualfitting.arcore.assets

import com.example.virtualfitting.arcore.contract.AssetSource
import com.example.virtualfitting.arcore.contract.ErrorCode

sealed interface ResolvedAsset {
    /** Sceneview `rememberModelInstance(modelLoader, assetPath)` 에 바로 전달 가능한 assets 경로. */
    data class LocalAssetPath(val path: String) : ResolvedAsset
}

interface AssetResolver {
    /** 실패 시 contract 의 [ErrorCode] 로 매핑된 실패 사유를 반환한다. */
    fun resolve(source: AssetSource): Result<ResolvedAsset>
}

class LocalOnlyAssetResolver : AssetResolver {
    override fun resolve(source: AssetSource): Result<ResolvedAsset> = when (source) {
        is AssetSource.LocalAsset -> Result.success(ResolvedAsset.LocalAssetPath(source.assetPath))
        is AssetSource.RemoteModel -> Result.failure(
            AssetException(ErrorCode.ASSET_URL_INVALID, "Remote model resolution not yet implemented")
        )
    }
}

class AssetException(val code: ErrorCode, message: String) : RuntimeException(message)
