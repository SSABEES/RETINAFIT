package com.example.virtualfitting.arcore.contract

data class RequestEnvelope<T>(
    val command: String,
    val requestId: String,
    val payload: T,
    val version: Int = 1,
)

data class EventEnvelope<D>(
    val requestId: String,
    val event: String,
    val data: D? = null,
    val version: Int = 1,
)
