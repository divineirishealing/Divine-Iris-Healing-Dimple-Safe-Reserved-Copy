"""Parse .docx files into program draft_content_sections (stdlib only — no python-docx)."""
from __future__ import annotations

import re
import zipfile
from io import BytesIO
from typing import Any, Dict, List, Optional

_W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
_WP = f"{{{_W_NS}}}"


def docx_bytes_to_text(data: bytes) -> str:
    """Extract plain text from a .docx file, preserving paragraph breaks."""
    try:
        with zipfile.ZipFile(BytesIO(data)) as zf:
            xml_bytes = zf.read("word/document.xml")
    except (KeyError, zipfile.BadZipFile) as exc:
        raise ValueError("Invalid or corrupt .docx file") from exc

    import xml.etree.ElementTree as ET

    root = ET.fromstring(xml_bytes)
    paragraphs: List[str] = []
    for para in root.iter(f"{_WP}p"):
        parts: List[str] = []
        for node in para.iter():
            if node.tag == f"{_WP}t" and node.text:
                parts.append(node.text)
            elif node.tag == f"{_WP}tab":
                parts.append("\t")
            elif node.tag in (f"{_WP}br", f"{_WP}cr"):
                parts.append("\n")
        line = "".join(parts).strip()
        if line:
            paragraphs.append(line)
    return "\n\n".join(paragraphs)


def _blank_placeholders() -> List[Dict[str, Any]]:
    """Template slots kept blank so live page skips generic headings."""
    return [
        {"id": "journey", "section_type": "journey", "title": "", "subtitle": "", "body": "", "image_url": "", "is_enabled": True, "order": 0},
        {"id": "who_for", "section_type": "who_for", "title": "", "subtitle": "", "body": "", "image_url": "", "is_enabled": True, "order": 1},
        {"id": "why_now", "section_type": "why_now", "title": "", "subtitle": "", "body": "", "image_url": "", "is_enabled": True, "order": 3},
    ]


def _find_quote_paragraph(paragraphs: List[str]) -> Optional[int]:
    for i, p in enumerate(paragraphs):
        t = p.strip()
        if (t.startswith('"') or t.startswith('"')) and len(t) > 40:
            return i
    return None


def _find_body_split_index(paragraphs: List[str]) -> int:
    """Split intro vs remainder — prefer a major heading in the second half of the doc."""
    markers = (
        r"^(\*\*)?(The Healing Modalities|How The Program Works|Program Details|Why .+ Unlike)",
        r"^(\*\*)?(Module|Section|Chapter)\s+\d",
    )
    for i, p in enumerate(paragraphs):
        t = p.strip()
        for pat in markers:
            if re.match(pat, t, re.I):
                return i
    return max(1, len(paragraphs) // 2)


def build_draft_sections_from_text(text: str) -> List[Dict[str, Any]]:
    """Turn document plain text into draft_content_sections for the admin panel."""
    text = (text or "").strip()
    if not text:
        raise ValueError("Document is empty")

    paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    if not paragraphs:
        raise ValueError("Document is empty")

    quote_idx = _find_quote_paragraph(paragraphs)
    split_idx = _find_body_split_index(paragraphs)

    intro_parts = [p for i, p in enumerate(paragraphs) if i < split_idx and i != quote_idx]
    body_parts = [p for i, p in enumerate(paragraphs) if i >= split_idx and i != quote_idx]
    experience_body = paragraphs[quote_idx] if quote_idx is not None else ""

    sections = _blank_placeholders()

    if experience_body:
        sections.append({
            "id": "experience",
            "section_type": "experience",
            "title": "",
            "subtitle": "",
            "body": experience_body,
            "image_url": "",
            "is_enabled": True,
            "order": 2,
        })

    if intro_parts:
        sections.append({
            "id": "doc_intro",
            "section_type": "document",
            "title": "",
            "subtitle": "",
            "body": "\n\n".join(intro_parts),
            "image_url": "",
            "is_enabled": True,
            "order": -1,
        })

    if body_parts:
        sections.append({
            "id": "doc_body",
            "section_type": "document",
            "title": "",
            "subtitle": "",
            "body": "\n\n".join(body_parts),
            "image_url": "",
            "is_enabled": True,
            "order": 4,
        })

    if not any(s.get("body") for s in sections if s["section_type"] in ("document", "experience")):
        sections.append({
            "id": "doc_body",
            "section_type": "document",
            "title": "",
            "subtitle": "",
            "body": text,
            "image_url": "",
            "is_enabled": True,
            "order": 4,
        })

    return sections
