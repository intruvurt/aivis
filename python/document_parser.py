"""Enhanced document parsing for uploaded files.

Uses PyMuPDF for PDFs and python-docx for DOCX files,
providing better extraction quality than the Node-side parsers.
"""

from __future__ import annotations

import base64
import io
import re
from typing import Any


class DocumentParser:
    """Parse uploaded documents and extract structured content."""

    SUPPORTED_MIME_TYPES = {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/html",
        "text/markdown",
        "text/plain",
    }

    def parse(
        self,
        filename: str,
        content_base64: str,
        mime_type: str,
    ) -> dict[str, Any]:
        """Parse a document and return extracted content."""
        raw = base64.b64decode(content_base64)

        if mime_type == "application/pdf":
            return self._parse_pdf(raw, filename)
        elif mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            return self._parse_docx(raw, filename)
        elif mime_type in ("text/html", "text/htm"):
            return self._parse_html(raw.decode("utf-8", errors="replace"), filename)
        elif mime_type == "text/markdown":
            return self._parse_markdown(raw.decode("utf-8", errors="replace"), filename)
        elif mime_type == "text/plain":
            text = raw.decode("utf-8", errors="replace")
            return {
                "filename": filename,
                "mime_type": mime_type,
                "text": text,
                "word_count": len(text.split()),
                "headings": [],
                "pages": 1,
                "title": filename,
            }
        else:
            return {
                "filename": filename,
                "mime_type": mime_type,
                "error": f"Unsupported mime type: {mime_type}",
                "text": "",
                "headings": [],
            }

    def _parse_pdf(self, raw: bytes, filename: str) -> dict[str, Any]:
        """Extract text and structure from PDF using PyMuPDF."""
        import fitz  # PyMuPDF

        doc = fitz.open(stream=raw, filetype="pdf")
        pages_text: list[str] = []
        headings: list[str] = []
        total_images = 0

        for page in doc:
            text = page.get_text("text")
            pages_text.append(text)

            # Extract headings via font size heuristics
            blocks = page.get_text("dict", flags=fitz.TEXTFLAGS_TEXT)
            for block in blocks.get("blocks", []):
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        # Font size > 14pt is likely a heading
                        if span.get("size", 0) > 14 and span.get("text", "").strip():
                            heading = span["text"].strip()
                            if heading and heading not in headings:
                                headings.append(heading)

            total_images += len(page.get_images(full=True))

        full_text = "\n\n".join(pages_text)
        doc.close()

        return {
            "filename": filename,
            "mime_type": "application/pdf",
            "text": full_text,
            "word_count": len(full_text.split()),
            "pages": len(pages_text),
            "headings": headings[:50],
            "image_count": total_images,
            "title": headings[0] if headings else filename,
        }

    def _parse_docx(self, raw: bytes, filename: str) -> dict[str, Any]:
        """Extract text and structure from DOCX using python-docx."""
        from docx import Document

        doc = Document(io.BytesIO(raw))

        paragraphs: list[str] = []
        headings: list[str] = []

        for para in doc.paragraphs:
            text = para.text.strip()
            if not text:
                continue
            paragraphs.append(text)
            # Heading styles
            if para.style and para.style.name and para.style.name.startswith("Heading"):
                headings.append(text)

        full_text = "\n".join(paragraphs)

        # Count images (shapes/inline shapes)
        image_count = 0
        for rel in doc.part.rels.values():
            if "image" in rel.reltype:
                image_count += 1

        return {
            "filename": filename,
            "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text": full_text,
            "word_count": len(full_text.split()),
            "pages": max(1, len(paragraphs) // 30),  # Rough estimate
            "headings": headings[:50],
            "image_count": image_count,
            "title": headings[0] if headings else filename,
        }

    def _parse_html(self, html: str, filename: str) -> dict[str, Any]:
        """Extract text and structure from HTML."""
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(html, "lxml")

        # Remove non-visible elements
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()

        # Extract title
        title_tag = soup.find("title")
        title = title_tag.get_text(strip=True) if title_tag else filename

        # Extract headings
        headings = []
        for level in range(1, 7):
            for h in soup.find_all(f"h{level}"):
                text = h.get_text(strip=True)
                if text:
                    headings.append(text)

        full_text = soup.get_text(separator=" ", strip=True)
        full_text = re.sub(r"\s+", " ", full_text)

        return {
            "filename": filename,
            "mime_type": "text/html",
            "text": full_text,
            "word_count": len(full_text.split()),
            "pages": 1,
            "headings": headings[:50],
            "title": title,
        }

    def _parse_markdown(self, md: str, filename: str) -> dict[str, Any]:
        """Extract text and structure from Markdown."""
        headings = re.findall(r"^#{1,6}\s+(.+)$", md, re.MULTILINE)

        # Strip markdown syntax for plain text
        text = re.sub(r"#{1,6}\s+", "", md)
        text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
        text = re.sub(r"\*(.+?)\*", r"\1", text)
        text = re.sub(r"`(.+?)`", r"\1", text)
        text = re.sub(r"\[(.+?)\]\(.+?\)", r"\1", text)
        text = re.sub(r"!\[.*?\]\(.+?\)", "", text)

        return {
            "filename": filename,
            "mime_type": "text/markdown",
            "text": text,
            "word_count": len(text.split()),
            "pages": 1,
            "headings": headings[:50],
            "title": headings[0] if headings else filename,
        }
