from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(isolated_settings):
    from app.main import create_app

    return TestClient(create_app())


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ingest_and_query_via_api(client, knowledge_dir):
    ingest_response = client.post(
        "/api/rag/ingest",
        json={"knowledge_dir": str(knowledge_dir), "reset": True, "persist": False},
    )
    assert ingest_response.status_code == 200
    body = ingest_response.json()
    assert body["documents"] >= 13
    assert body["store_size"] == body["chunks"]

    query_response = client.post(
        "/api/rag/query",
        json={"question": "BVD가 너무 가까울 때 어떻게 대응?", "include_debug": True},
    )
    assert query_response.status_code == 200
    payload = query_response.json()
    assert payload["answer"]
    assert payload["retrieved"]
    assert payload["debug"]["prompt"] is not None


def test_customer_report_via_api(client, knowledge_dir):
    """BE가 visit/test/recommend/fitting JSON을 그대로 넘긴다고 가정한 손님용 리포트 생성."""
    client.post(
        "/api/rag/ingest",
        json={"knowledge_dir": str(knowledge_dir), "reset": True, "persist": False},
    )
    response = client.post(
        "/api/rag/report",
        json={
            "visit_summary": {"cust_name": "홍길동", "cust_age": 38},
            "measurements": {
                "face_shape": "둥근형",
                "PD": 64.5, "PD_left": 32.0, "PD_right": 32.5,
                "OH": 22.1, "BVD": 13.2, "PT": 9.5, "Wrap": 4.0,
            },
            "recommend_options": {
                "렌즈": "누진",
                "코팅": ["고굴절", "블루라이트"],
                "생활": "사무직",
            },
            "fitting": {
                "vp": {"frame": "오벌 BrandA", "feedback": "코받침 살짝 벌림"},
                "real": {"BVD": 12.8, "OH": 22.0, "TILT": 9},
            },
            "include_debug": True,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["answer"]
    assert payload["retrieved"]

    prompt = payload["debug"]["prompt"]
    # 손님용 리포트가 의도한 가이드를 받았는지 확인
    assert "손님이 읽기 쉬운" in prompt
    assert "PD(동공 사이 거리)" in prompt
    assert "출력 JSON 스키마" in prompt
    # 입력 데이터가 누락 없이 들어갔는지
    assert "둥근형" in prompt
    assert "64.5" in prompt
    assert "누진" in prompt
    # 컨텍스트로 운영 톤·용어 가이드가 검색됐는지
    titles = {r["metadata"].get("title", "") for r in payload["retrieved"]}
    assert any("용어" in t for t in titles), f"glossary doc should be retrieved, got {titles}"


def test_recommend_via_api(client, knowledge_dir):
    client.post(
        "/api/rag/ingest",
        json={"knowledge_dir": str(knowledge_dir), "reset": True, "persist": False},
    )
    response = client.post(
        "/api/rag/recommend",
        json={
            "face_measurements": {"face_shape": "사각형", "PD": 65.0},
            "recommend_options": {"렌즈": "누진", "옵션": ["블루라이트"]},
            "glasses_catalog": [
                {
                    "glasses_no": 11,
                    "glasses_name": "라운드 모던",
                    "glasses_brand": "BrandX",
                    "glasses_spec_json": {"shape": "라운드"},
                }
            ],
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["answer"]
    assert payload["retrieved"]
