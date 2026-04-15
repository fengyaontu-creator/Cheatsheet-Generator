"""
Unified file-to-text extraction using markitdown.

Accepts any document format supported by markitdown (PDF, DOCX, PPTX, XLSX,
HTML, CSV, JSON, XML, plain text, etc.) and returns Markdown text.
"""

from __future__ import annotations

import asyncio
import tempfile
from pathlib import Path

from markitdown import MarkItDown


_md = MarkItDown()

# Extensions that markitdown can handle as documents
DOCUMENT_EXTENSIONS: set[str] = {
    ".pdf", ".docx", ".pptx", ".xlsx", ".xls",
    ".html", ".htm", ".csv", ".json", ".xml",
    ".txt", ".md", ".rst", ".rtf",
}

# MIME prefixes / types treated as images (not documents)
IMAGE_CONTENT_TYPES: set[str] = {
    "image/png", "image/jpeg", "image/webp", "image/gif",
    "image/bmp", "image/tiff",
}


def is_image(content_type: str | None, filename: str | None) -> bool:
    """Return True if the file should be treated as an image, not a document."""
    if content_type and content_type in IMAGE_CONTENT_TYPES:
        return True
    if filename:
        ext = Path(filename).suffix.lower()
        if ext in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tiff"}:
            return True
    return False


def is_supported_document(filename: str | None) -> bool:
    """Return True if the file extension is a known document type."""
    if not filename:
        return True  # try anyway
    ext = Path(filename).suffix.lower()
    return ext in DOCUMENT_EXTENSIONS


def _extract_text_sync(data: bytes, filename: str) -> str:
    """Synchronous markitdown conversion (runs in a thread via asyncio.to_thread)."""
    suffix = Path(filename).suffix or ".bin"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name

    try:
        result = _md.convert(tmp_path)
        return result.text_content or ""
    finally:
        Path(tmp_path).unlink(missing_ok=True)


async def extract_text(data: bytes, filename: str) -> str:
    """Convert a single document file to Markdown text via markitdown."""
    return await asyncio.to_thread(_extract_text_sync, data, filename)


async def extract_text_from_files(
    files: list[tuple[str, bytes]],
) -> str:
    """
    Convert multiple document files to a single merged Markdown string.

    All files are converted in parallel (threads) so 3 large PDFs take
    roughly the time of the slowest one, not the sum.
    """
    results = await asyncio.gather(
        *(extract_text(data, filename) for filename, data in files)
    )
    return "\n\n---\n\n".join(text.strip() for text in results if text.strip())
