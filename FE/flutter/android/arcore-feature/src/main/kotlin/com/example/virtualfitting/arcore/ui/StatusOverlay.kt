package com.example.virtualfitting.arcore.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

@Composable
fun StatusOverlay(
    title: String,
    faceCount: Int,
    statusMessage: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .background(
                color = Color(0xAA111111),
                shape = RoundedCornerShape(20.dp),
            )
            .padding(horizontal = 18.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            color = Color.White,
        )
        Text(
            text = "Tracking Faces: $faceCount",
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFFB9F6CA),
        )
        Text(
            text = statusMessage,
            style = MaterialTheme.typography.bodySmall,
            color = Color.White,
        )
    }
}
