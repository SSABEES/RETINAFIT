from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from app.rag.chunker import chunk_documents
from app.rag.documents import Document
from app.rag.embeddings.base import EmbeddingProvider
from app.rag.loaders import load_markdown_directory
from app.rag.vector_store.base import VectorStore


@dataclass
class IngestionResult:
    source: str
    documents: int
    chunks: int


def run_ingestion_pipeline(
    *,
    knowledge_dir: str | Path,
    embedder: EmbeddingProvider,
    store: VectorStore,
    chunk_size: int,
    chunk_overlap: int,
    reset: bool = False,
    persist: bool = True,
) -> IngestionResult:
    """Load markdown files under ``knowledge_dir`` and upsert them.

    With ``reset=True`` the store is cleared first; otherwise existing
    documents are merged (chunk IDs are deterministic so re-ingesting
    the same source updates in place).
    """
    documents: list[Document] = load_markdown_directory(knowledge_dir)
    chunks = chunk_documents(documents, chunk_size=chunk_size, overlap=chunk_overlap)

    if reset:
        store.clear()
    if chunks:
        embeddings = embedder.embed_documents([c.text for c in chunks])
        store.upsert(chunks, embeddings)
    if persist:
        store.persist()

    return IngestionResult(
        source=str(knowledge_dir),
        documents=len(documents),
        chunks=len(chunks),
    )
