"""Tests for .docx draft import."""
import zipfile
from io import BytesIO

from utils.docx_import import (
    build_draft_sections_from_docx,
    build_draft_sections_from_text,
    docx_bytes_to_paragraphs,
    docx_bytes_to_text,
)


def _docx_xml(body_inner: str) -> bytes:
    xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{body_inner}</w:body></w:document>"
    )
    styles = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:style w:type="paragraph" w:styleId="Heading1">'
        '<w:name w:val="heading 1"/></w:style>'
        '</w:styles>'
    )
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("word/document.xml", xml)
        zf.writestr("word/styles.xml", styles)
    return buf.getvalue()


def _p(text: str, *, bold: bool = False, style: str = "", num: bool = False) -> str:
    rpr = "<w:rPr><w:b/></w:rPr>" if bold else ""
    ppr = ""
    if style:
        ppr += f'<w:pStyle w:val="{style}"/>'
    if num:
        ppr += "<w:numPr><w:ilvl w:val=\"0\"/><w:numId w:val=\"1\"/></w:numPr>"
    ppr_tag = f"<w:pPr>{ppr}</w:pPr>" if ppr else ""
    return f"<w:p>{ppr_tag}<w:r>{rpr}<w:t>{text}</w:t></w:r></w:p>"


def test_docx_bytes_to_text():
    data = _docx_xml(_p("Hello world") + _p("Second paragraph"))
    text = docx_bytes_to_text(data)
    assert "Hello world" in text
    assert "Second paragraph" in text


def test_bold_becomes_markup():
    data = _docx_xml(_p("Important line", bold=True))
    paras = docx_bytes_to_paragraphs(data)
    assert paras[0].formatted == "**Important line**"


def test_heading_style_becomes_heading():
    data = _docx_xml(_p("Program Overview", style="Heading1"))
    paras = docx_bytes_to_paragraphs(data)
    assert paras[0].kind == "heading"
    assert paras[0].formatted == "**Program Overview**"


def test_single_document_section_no_split():
    text = (
        "Opening intro paragraph.\n\n"
        "**Program Overview**\n\n"
        "Program Overview\n\n"
        "Body paragraph here."
    )
    sections = build_draft_sections_from_text(text)
    doc_sections = [s for s in sections if s.get("section_type") == "document"]
    assert len(doc_sections) == 1
    assert doc_sections[0]["id"] == "doc_main"
    body = doc_sections[0]["body"]
    assert "Opening intro" in body
    assert "**Program Overview**" in body
    # duplicate plain line after heading should be removed
    assert body.count("Program Overview") == 1


def test_quotes_stay_in_document_body():
    text = (
        "Intro text.\n\n"
        '"What if healing began within the deepest layers of your own soul?"\n\n'
        "More body content."
    )
    sections = build_draft_sections_from_text(text)
    exp = next((s for s in sections if s.get("section_type") == "experience"), None)
    doc = next(s for s in sections if s.get("id") == "doc_main")
    assert exp is None
    assert "What if healing" in doc["body"]


def test_build_draft_sections_from_docx():
    inner = (
        _p("AMRP Introduction")
        + _p("Atomic Memory Reprogramming", style="Heading1")
        + _p("Core benefits", bold=True)
        + _p("First benefit point", num=True)
    )
    sections = build_draft_sections_from_docx(_docx_xml(inner))
    doc = next(s for s in sections if s["section_type"] == "document")
    assert doc["body"].startswith("@@DOCX_HTML@@")
    assert "Atomic Memory Reprogramming" in doc["body"]
    assert "Core benefits" in doc["body"]
    assert "First benefit point" in doc["body"]


def test_amrp_style_import_skips_preamble_and_preserves_headings():
    """AMRP writeup HTML: skip cover lines; keep headings and bullets."""
    from pathlib import Path
    from utils.docx_html import is_docx_html_body

    src = Path(__file__).resolve().parent / "fixtures" / "AMRP_Program_Writeup.docx"
    if not src.exists():
        import pytest
        pytest.skip("AMRP fixture doc not on this machine")

    sections = build_draft_sections_from_docx(src.read_bytes())
    doc = next(s for s in sections if s["id"] == "doc_main")
    body = doc["body"]

    assert is_docx_html_body(body)
    assert "Atomic Musculoskeletal" in body
    assert "docx-rule" in body
    assert "Every day, millions" in body
    assert "What Is the Atomic Musculoskeletal Regeneration Program?" in body
    assert "Section 1 — Bones &amp; Joints" in body or "Section 1 — Bones & Joints" in body
    assert "Osteoarthritis" in body
    assert "Georgia" in body


def test_paragraph_alignment_prefix():
    inner = (
        _p("Centered tagline", style="")
        .replace("<w:p>", '<w:p><w:pPr><w:jc w:val="center"/></w:pPr>')
        + _p("Justified body text")
        .replace("<w:p>", '<w:p><w:pPr><w:jc w:val="both"/></w:pPr>')
    )
    sections = build_draft_sections_from_docx(_docx_xml(inner))
    body = next(s for s in sections if s["id"] == "doc_main")["body"]
    assert "Centered tagline" in body
    assert "Justified body text" in body
    assert "text-align:center" in body.replace(" ", "")
    assert "text-align:justify" in body.replace(" ", "")


def test_question_line_stays_in_document_when_not_word_heading():
    """Faithful import: plain question lines stay in the document body."""
    from utils.docx_import import ParsedParagraph, _ensure_heading_markup

    paras = [
        ParsedParagraph(formatted="Intro paragraph text.", plain="Intro paragraph text.", kind="body"),
        ParsedParagraph(formatted="What Is AMRP?", plain="What Is AMRP?", kind="body"),
    ]
    out = _ensure_heading_markup(paras)
    assert out[1].kind == "body"
    assert out[1].formatted == "What Is AMRP?"
