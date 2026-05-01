from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from app.rag.documents import Document

_FRONTMATTER_RE = re.compile(r"^---\s*\n(?P<fm>.*?)\n---\s*\n?(?P<body>.*)$", re.DOTALL)
_LIST_RE = re.compile(r"^\[(?P<inner>.*)\]$")


def load_markdown_directory(root: str | Path) -> list[Document]:
    """Recursively load `.md` files under `root` into Documents.

    Each file becomes one Document; YAML frontmatter (if present) is
    parsed into metadata. Supported frontmatter scalar types: string,
    int, float, list-of-strings (e.g. ``tags: [a, b]``).
    """
    root_path = Path(root)
    if not root_path.exists():
        return []
    docs: list[Document] = []
    for path in sorted(root_path.rglob("*.md")):
        if not path.is_file():
            continue
        docs.append(load_markdown_file(path, root=root_path))
    return docs


def load_markdown_file(path: str | Path, *, root: str | Path | None = None) -> Document:
    file_path = Path(path)
    raw = file_path.read_text(encoding="utf-8")
    metadata, body = _split_frontmatter(raw)
    base = Path(root) if root is not None else file_path.parent
    try:
        rel_source = str(file_path.relative_to(base))
    except ValueError:
        rel_source = file_path.name
    metadata.setdefault("source", rel_source)
    metadata.setdefault("filename", file_path.name)
    return Document(text=body.strip(), metadata=metadata)


def _split_frontmatter(raw: str) -> tuple[dict[str, Any], str]:
    match = _FRONTMATTER_RE.match(raw)
    if not match:
        return {}, raw
    fm_text = match.group("fm")
    body = match.group("body")
    return _parse_frontmatter(fm_text), body


def _parse_frontmatter(text: str) -> dict[str, Any]:
    metadata: dict[str, Any] = {}
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        metadata[key.strip()] = _coerce(value.strip())
    return metadata


def _coerce(value: str) -> Any:
    if not value:
        return ""
    if value.startswith('"') and value.endswith('"'):
        return value[1:-1]
    if value.startswith("'") and value.endswith("'"):
        return value[1:-1]
    list_match = _LIST_RE.match(value)
    if list_match:
        inner = list_match.group("inner")
        return [item.strip().strip('"').strip("'") for item in inner.split(",") if item.strip()]
    if value.lower() in {"true", "false"}:
        return value.lower() == "true"
    try:
        if "." in value:
            return float(value)
        return int(value)
    except ValueError:
        return value
