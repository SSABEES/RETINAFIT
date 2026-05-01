from __future__ import annotations

from app.rag.chunker import chunk_documents
from app.rag.loaders import load_markdown_directory


def test_loader_parses_frontmatter(knowledge_dir):
    docs = load_markdown_directory(knowledge_dir)
    assert len(docs) >= 13, "knowledge base should contain at least 13 markdown docs"

    titled = [d for d in docs if "title" in d.metadata]
    assert titled, "frontmatter parsing failed: no documents with `title`"

    sample = next(d for d in docs if d.metadata.get("filename") == "06_frame_recommendation.md")
    assert sample.metadata.get("category") == "추천/Recommendation"
    assert isinstance(sample.metadata.get("tags"), list)
    assert "프레임" in sample.metadata["tags"]


def test_chunker_keeps_short_docs_intact(knowledge_dir):
    docs = load_markdown_directory(knowledge_dir)
    chunks = chunk_documents(docs, chunk_size=800, overlap=120)
    assert chunks, "chunker produced zero chunks"
    for chunk in chunks:
        assert "parent_id" in chunk.metadata
        assert "section_index" in chunk.metadata


def test_ingest_then_query_end_to_end(rag_service, knowledge_dir):
    result = rag_service.ingest(knowledge_dir=str(knowledge_dir), reset=True, persist=False)
    assert result.documents >= 13
    assert result.chunks >= result.documents
    assert rag_service.store.size() == result.chunks

    rag = rag_service.query("단안 PD 차이가 2mm 이상이면 어떻게 하나요?")
    assert rag.answer.startswith("[dummy-llm]")
    assert rag.retrieved, "retrieval should return at least one chunk"

    titles = {r.document.metadata.get("title", "") for r in rag.retrieved}
    assert any("PD" in title for title in titles), f"expected PD-related docs, got {titles}"


def test_filters_by_category(rag_service, knowledge_dir):
    rag_service.ingest(knowledge_dir=str(knowledge_dir), reset=True, persist=False)
    rag = rag_service.query(
        "사각형 얼굴형에 어울리는 프레임은?",
        filters={"category": "추천/Recommendation"},
    )
    assert rag.retrieved
    for item in rag.retrieved:
        assert item.document.metadata.get("category") == "추천/Recommendation"


def test_recommend_includes_catalog_and_options(rag_service, knowledge_dir):
    rag_service.ingest(knowledge_dir=str(knowledge_dir), reset=True, persist=False)
    rag = rag_service.recommend(
        face_measurements={"face_shape": "둥근형", "PD": 64.0, "OH": 22.0},
        recommend_options=["다초점", "변색", "사무직"],
        glasses_catalog=[
            {
                "glasses_no": 1,
                "glasses_name": "오벌 스타일",
                "glasses_brand": "BrandA",
                "glasses_spec_json": {"shape": "오벌", "material": "TR-90"},
            },
            {
                "glasses_no": 2,
                "glasses_name": "스퀘어 클래식",
                "glasses_brand": "BrandB",
                "glasses_spec_json": {"shape": "스퀘어"},
            },
        ],
    )
    assert "BrandA" in rag.prompt
    assert "다초점" in rag.prompt
    assert rag.retrieved
