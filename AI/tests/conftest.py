from __future__ import annotations

import pytest


@pytest.fixture
def isolated_settings(monkeypatch):
    """Reset DI caches between tests so each test gets fresh providers."""
    from app.core import deps
    from app.core.config import settings

    monkeypatch.setattr(settings, "LLM_PROVIDER", "dummy")

    deps.reset_caches()
    yield settings
    deps.reset_caches()
