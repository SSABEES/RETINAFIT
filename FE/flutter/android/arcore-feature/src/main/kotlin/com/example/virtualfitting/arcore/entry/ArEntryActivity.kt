package com.example.virtualfitting.arcore.entry

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.example.virtualfitting.arcore.api.SessionRegistry
import com.example.virtualfitting.arcore.contract.CloseReason
import com.example.virtualfitting.arcore.contract.VirtualFittingEvent
import com.example.virtualfitting.arcore.rendering.FaceFittingScreen

class ArEntryActivity : ComponentActivity() {

    companion object {
        const val EXTRA_REQUEST_ID = "com.example.virtualfitting.arcore.REQUEST_ID"
    }

    private var requestId: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val id = intent.getStringExtra(EXTRA_REQUEST_ID)
        val entry = id?.let { SessionRegistry.get(it) }
        if (id == null || entry == null) {
            // 요청 정보가 없으면 조용히 종료 — 호스트가 재시도해야 한다.
            finish()
            return
        }
        requestId = id

        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    FaceFittingScreen(
                        request = entry.request,
                        emit = entry.dispatcher::emit,
                        onClose = { finish() },
                    )
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        val id = requestId ?: return
        val entry = SessionRegistry.get(id)
        entry?.dispatcher?.emit(
            VirtualFittingEvent.Closed(requestId = id, reason = CloseReason.USER_CLOSED)
        )
        SessionRegistry.release(id)
    }
}
