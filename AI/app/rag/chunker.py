from __future__ import annotations

import re

from app.rag.documents import Document

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+)$")


def chunk_documents(
    documents: list[Document],
    *,
    chunk_size: int,
    overlap: int,
) -> list[Document]:
    """Split each Document into smaller chunks while preserving metadata.

    Strategy: split on Markdown headings first; if a section is still
    larger than ``chunk_size``, fall back to a sliding character window.
    For sections shorter than ``chunk_size`` the whole section becomes a
    single chunk so curated mini-docs (like our knowledge base) are
    not over-fragmented.
    """
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")
    overlap = max(0, min(overlap, chunk_size - 1))

    chunks: list[Document] = []
    for doc in documents:
        for section_idx, (heading, body) in enumerate(_split_by_headings(doc.text)):
            text = _compose(heading, body)
            if not text.strip():
                continue
            if len(text) <= chunk_size:
                chunks.append(_make_chunk(doc, section_idx, 0, heading, text))
                continue
            for part_idx, piece in enumerate(_window(text, chunk_size, overlap)):
                chunks.append(_make_chunk(doc, section_idx, part_idx, heading, piece))
    return chunks


def _split_by_headings(text: str) -> list[tuple[str | None, str]]:
    sections: list[tuple[str | None, list[str]]] = []
    current_heading: str | None = None
    current_body: list[str] = []
    for line in text.splitlines():
        match = _HEADING_RE.match(line)
        if match:
            if current_heading is not None or current_body:
                sections.append((current_heading, current_body))
            current_heading = match.group(2).strip()
            current_body = []
        else:
            current_body.append(line)
    if current_heading is not None or current_body:
        sections.append((current_heading, current_body))
    return [(heading, "\n".join(body).strip()) for heading, body in sections]


def _compose(heading: str | None, body: str) -> str:
    if heading and body:
        return f"# {heading}\n\n{body}"
    if heading:
        return f"# {heading}"
    return body


def _window(text: str, size: int, overlap: int) -> list[str]:
    pieces: list[str] = []
    step = max(1, size - overlap)
    for start in range(0, len(text), step):
        end = start + size
        pieces.append(text[start:end])
        if end >= len(text):
            break
    return pieces


def _make_chunk(
    doc: Document,
    section_idx: int,
    part_idx: int,
    heading: str | None,
    text: str,
) -> Document:
    metadata = dict(doc.metadata)
    metadata["parent_id"] = doc.id
    metadata["section_index"] = section_idx
    metadata["part_index"] = part_idx
    if heading:
        metadata["heading"] = heading
    chunk_id = f"{doc.id}:{section_idx}:{part_idx}"
    return Document(text=text, metadata=metadata, id=chunk_id)
