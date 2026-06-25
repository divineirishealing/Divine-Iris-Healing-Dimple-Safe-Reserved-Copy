"""Parse .docx files into program draft_content_sections (stdlib only — no python-docx)."""
from __future__ import annotations

import re
import zipfile
from dataclasses import dataclass
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple
from xml.etree import ElementTree as ET

_W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
_WP = f"{{{_W_NS}}}"
_VAL = f"{{{_W_NS}}}val"
_STYLE_ID = f"{{{_W_NS}}}styleId"


@dataclass
class ParsedParagraph:
    """One logical paragraph from Word, with markup for the live DocumentBody renderer."""

    formatted: str
    plain: str
    kind: str  # heading | subheading | quote | bullet | body


def _load_style_names(docx_bytes: bytes) -> Dict[str, str]:
    """Map w:styleId → lowercased style name (e.g. Heading1 → heading 1)."""
    names: Dict[str, str] = {}
    try:
        with zipfile.ZipFile(BytesIO(docx_bytes)) as zf:
            if "word/styles.xml" not in zf.namelist():
                return names
            root = ET.fromstring(zf.read("word/styles.xml"))
    except (KeyError, zipfile.BadZipFile, ET.ParseError):
        return names

    for style in root.iter(f"{_WP}style"):
        sid = style.attrib.get(_STYLE_ID, "")
        name_el = style.find(f"{_WP}name")
        if not sid or name_el is None:
            continue
        val = (name_el.attrib.get(_VAL) or "").strip().lower()
        if val:
            names[sid] = val
    return names


def _run_is_on(rpr: Optional[ET.Element], tag: str) -> bool:
    if rpr is None:
        return False
    el = rpr.find(f"{_WP}{tag}")
    if el is None:
        return False
    v = el.attrib.get(_VAL)
    if v is None:
        return True
    return str(v).lower() not in ("0", "false", "none")


def _format_run(run: ET.Element) -> str:
    parts: List[str] = []
    for node in run.iter():
        if node.tag == f"{_WP}t" and node.text:
            parts.append(node.text)
        elif node.tag == f"{_WP}tab":
            parts.append("\t")
        elif node.tag in (f"{_WP}br", f"{_WP}cr"):
            parts.append("\n")
    text = "".join(parts)
    if not text:
        return ""

    rpr = run.find(f"{_WP}rPr")
    bold = _run_is_on(rpr, "b")
    italic = _run_is_on(rpr, "i")
    highlight = rpr is not None and rpr.find(f"{_WP}highlight") is not None

    # Highlight in Word → emphasise (headings / callouts on the live page use **)
    if highlight and not bold:
        bold = True

    if bold and italic:
        return f"**{text}**"
    if bold:
        return f"**{text}**"
    if italic:
        return f"*{text}*"
    return text


def _paragraph_style_id(p: ET.Element) -> str:
    ppr = p.find(f"{_WP}pPr")
    if ppr is None:
        return ""
    ps = ppr.find(f"{_WP}pStyle")
    if ps is None:
        return ""
    return (ps.attrib.get(_VAL) or "").strip()


def _paragraph_is_list(p: ET.Element) -> bool:
    ppr = p.find(f"{_WP}pPr")
    if ppr is None:
        return False
    return ppr.find(f"{_WP}numPr") is not None


def _collapse_markup(text: str) -> str:
    """Merge adjacent ** runs and strip empty markup."""
    s = text
    # **foo****bar** → **foobar**
    prev = None
    while prev != s:
        prev = s
        s = re.sub(r"\*\*\s*\*\*", "", s)
    return re.sub(r"\s{2,}", " ", s).strip()


def _plain_text(formatted: str) -> str:
    return re.sub(r"\*+", "", formatted).strip()


def _classify_paragraph(formatted: str, plain: str, style_name: str, is_list: bool) -> str:
    if not plain:
        return "body"

    sn = (style_name or "").lower()
    if re.search(r"heading\s*1|^title$|^subtitle$", sn):
        return "heading"
    if re.search(r"heading\s*[2-3]", sn):
        return "subheading"

    if (plain.startswith('"') and plain.endswith('"')) or (plain.startswith('"') and plain.endswith('"')):
        if len(plain) > 30:
            return "quote"

    # Whole paragraph already marked bold → heading or subheading
    bold_only = re.match(r"^\*\*(.+)\*\*$", formatted.strip(), re.S)
    if bold_only:
        inner = bold_only.group(1).strip()
        if len(inner) < 80 and (inner.isupper() or re.match(r"^[A-Z0-9][^.!?]*$", inner)):
            return "heading"
        if len(inner) < 120:
            return "subheading"

    if is_list or re.match(r"^[•●○▪\-–—✦]\s", plain):
        return "bullet"

    return "body"


def _normalise_formatted_line(formatted: str, kind: str) -> str:
    plain = _plain_text(formatted)
    if not plain:
        return ""

    if kind == "heading":
        return f"**{plain}**"
    if kind == "subheading":
        return f"**{plain}**"
    if kind == "quote":
        if not (plain.startswith('"') or plain.startswith('"')):
            return f"*{plain}*"
        return plain
    if kind == "bullet":
        bullet_text = re.sub(r"^[•●○▪\-–—✦]\s*", "", plain)
        # Keep inline ** from Word inside bullet lines
        inner = formatted.strip()
        inner = re.sub(r"^[•●○▪\-–—✦]\s*", "", inner)
        if "**" in inner:
            return f"✦ {inner}"
        return f"✦ {bullet_text}"
    return formatted.strip()


def docx_bytes_to_paragraphs(data: bytes) -> List[ParsedParagraph]:
    """Extract paragraphs from .docx with heading/bold/bullet markup."""
    try:
        with zipfile.ZipFile(BytesIO(data)) as zf:
            xml_bytes = zf.read("word/document.xml")
    except (KeyError, zipfile.BadZipFile) as exc:
        raise ValueError("Invalid or corrupt .docx file") from exc

    style_names = _load_style_names(data)
    root = ET.fromstring(xml_bytes)
    parsed: List[ParsedParagraph] = []

    for para in root.iter(f"{_WP}p"):
        style_id = _paragraph_style_id(para)
        style_name = style_names.get(style_id, "")
        is_list = _paragraph_is_list(para)

        run_parts: List[str] = []
        for run in para.findall(f"{_WP}r"):
            chunk = _format_run(run)
            if chunk:
                run_parts.append(chunk)
        formatted = _collapse_markup("".join(run_parts))
        plain = _plain_text(formatted)
        if not plain:
            continue

        kind = _classify_paragraph(formatted, plain, style_name, is_list)
        formatted = _normalise_formatted_line(formatted, kind)
        plain = _plain_text(formatted)
        if not plain:
            continue

        parsed.append(ParsedParagraph(formatted=formatted, plain=plain, kind=kind))

    if not parsed:
        raise ValueError("Document is empty")
    return parsed


def docx_bytes_to_text(data: bytes) -> str:
    """Plain-text export (paragraphs joined) — used by tests and fallbacks."""
    return "\n\n".join(p.plain for p in docx_bytes_to_paragraphs(data))


def _dedupe_paragraphs(paragraphs: List[ParsedParagraph]) -> List[ParsedParagraph]:
    """Drop consecutive duplicates and heading+repeat-body pairs."""
    out: List[ParsedParagraph] = []
    seen_plain: set[str] = set()

    for p in paragraphs:
        norm = re.sub(r"\s+", " ", p.plain.strip().lower())
        if not norm:
            continue

        # Exact consecutive duplicate
        if out and re.sub(r"\s+", " ", out[-1].plain.strip().lower()) == norm:
            continue

        # Same paragraph text already appeared (common when Word repeats title lines)
        if norm in seen_plain and p.kind in ("body", "subheading"):
            continue

        # Body line that only repeats the previous heading text
        if out and out[-1].kind in ("heading", "subheading"):
            head = re.sub(r"\s+", " ", out[-1].plain.strip().lower())
            if norm == head or (norm.startswith(head) and len(norm) <= len(head) + 3):
                continue

        out.append(p)
        seen_plain.add(norm)

    return out


def _pick_experience_quote(paragraphs: List[ParsedParagraph]) -> Tuple[Optional[ParsedParagraph], List[ParsedParagraph]]:
    """
    If the doc has one clear pull-quote, use it for the dark Experience block
    and remove it from the main document (avoids showing the same text twice).
    """
    quote_indices = [i for i, p in enumerate(paragraphs) if p.kind == "quote"]
    if len(quote_indices) != 1:
        return None, paragraphs
    idx = quote_indices[0]
    quote = paragraphs[idx]
    rest = paragraphs[:idx] + paragraphs[idx + 1 :]
    return quote, rest


def _paragraphs_to_document_body(paragraphs: List[ParsedParagraph]) -> str:
    """Join paragraphs; headings get blank lines around them for DocumentBody."""
    blocks: List[str] = []
    for p in paragraphs:
        if p.kind == "heading":
            blocks.append(p.formatted)
        elif p.kind == "quote":
            blocks.append(p.formatted)
        else:
            blocks.append(p.formatted)
    return "\n\n".join(blocks)


def _blank_template_suppressors() -> List[Dict[str, Any]]:
    """
    Empty template slots so the live page does not inject generic
    Journey / Who For / Why Now headings alongside imported document text.
    """
    return [
        {"id": "journey", "section_type": "journey", "title": "", "subtitle": "", "body": "", "image_url": "", "is_enabled": True, "order": 0},
        {"id": "who_for", "section_type": "who_for", "title": "", "subtitle": "", "body": "", "image_url": "", "is_enabled": True, "order": 1},
        {"id": "why_now", "section_type": "why_now", "title": "", "subtitle": "", "body": "", "image_url": "", "is_enabled": True, "order": 3},
    ]


def build_draft_sections_from_paragraphs(paragraphs: List[ParsedParagraph]) -> List[Dict[str, Any]]:
    """Build minimal draft sections: suppressors + optional quote + one document block."""
    cleaned = _dedupe_paragraphs(paragraphs)
    quote, main = _pick_experience_quote(cleaned)

    sections = _blank_template_suppressors()

    if quote:
        sections.append({
            "id": "experience",
            "section_type": "experience",
            "title": "",
            "subtitle": "",
            "body": quote.formatted,
            "image_url": "",
            "is_enabled": True,
            "order": 2,
        })

    body = _paragraphs_to_document_body(main)
    if not body.strip():
        body = _paragraphs_to_document_body(cleaned)

    sections.append({
        "id": "doc_main",
        "section_type": "document",
        "title": "",
        "subtitle": "",
        "body": body,
        "image_url": "",
        "is_enabled": True,
        "order": -1,
    })

    return sections


def build_draft_sections_from_docx(data: bytes) -> List[Dict[str, Any]]:
    """Parse .docx bytes → draft_content_sections for admin import."""
    paragraphs = docx_bytes_to_paragraphs(data)
    return build_draft_sections_from_paragraphs(paragraphs)


def build_draft_sections_from_text(text: str) -> List[Dict[str, Any]]:
    """Fallback when only plain text is available."""
    text = (text or "").strip()
    if not text:
        raise ValueError("Document is empty")

    raw_paras = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    paragraphs: List[ParsedParagraph] = []
    for raw in raw_paras:
        plain = raw.strip()
        kind = "quote" if (plain.startswith('"') and len(plain) > 30) else "body"
        bold_m = re.match(r"^\*\*(.+)\*\*$", plain)
        if bold_m:
            kind = "heading" if len(bold_m.group(1)) < 80 else "subheading"
        elif re.match(r"^[✦•\-]", plain):
            kind = "bullet"
        formatted = plain if kind != "bullet" else (plain if plain.startswith("✦") else f"✦ {plain.lstrip('•-* ')}")
        paragraphs.append(ParsedParagraph(formatted=formatted, plain=_plain_text(formatted), kind=kind))

    return build_draft_sections_from_paragraphs(paragraphs)
