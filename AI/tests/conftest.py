from __future__ import annotations

from pathlib import Path

import pytest


PROJECT_ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE_DIR = PROJECT_ROOT / "data" / "knowledge"


@pytest.fixture
def sample_image_bytes() -> bytes:
    return b""


@pytest.fixture
def knowledge_dir() -> Path:
    return KNOWLEDGE_DIR


@pytest.fixture
def isolated_settings(tmp_path, monkeypatch):
    """Redirect vector store path to a temp dir and reset DI caches.

    Ensures every test starts with a clean in-memory store and that
    nothing is written into the real ``data/vectorstore`` directory.
    """
    from app.core import deps
    from app.core.config import settings

    monkeypatch.setattr(settings, "VECTOR_STORE_PATH", str(tmp_path / "vectorstore"))
    monkeypatch.setattr(settings, "LLM_PROVIDER", "dummy")
    monkeypatch.setattr(settings, "EMBEDDING_PROVIDER", "dummy")
    monkeypatch.setattr(settings, "EMBEDDING_DIM", 256)
    monkeypatch.setattr(settings, "RETRIEVAL_TOP_K", 4)

    deps.reset_caches()
    yield settings
    deps.reset_caches()


@pytest.fixture
def rag_service(isolated_settings):
    from app.core.deps import get_rag_service

    return get_rag_service()
