"""Tests for .docx draft import."""
import zipfile
from io import BytesIO

from utils.docx_import import build_draft_sections_from_text, docx_bytes_to_text


def _minimal_docx(paragraphs):
    body = "".join(
        f'<w:p><w:r><w:t>{p}</w:t></w:r></w:p>' for p in paragraphs
    )
    xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{body}</w:body></w:document>"
    )
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("word/document.xml", xml)
    return buf.getvalue()


def test_docx_bytes_to_text():
    data = _minimal_docx(["Hello world", "Second paragraph"])
    text = docx_bytes_to_text(data)
    assert "Hello world" in text
    assert "Second paragraph" in text


def test_build_draft_sections_splits_quote():
    text = (
        "Opening intro paragraph.\n\n"
        '"What if healing began within the deepest layers of your own soul?"\n\n'
        "The Healing Modalities — details here.\n\n"
        "More body content."
    )
    sections = build_draft_sections_from_text(text)
    types = {s["section_type"] for s in sections}
    assert "document" in types
    assert "experience" in types
    exp = next(s for s in sections if s["section_type"] == "experience")
    assert "What if healing" in exp["body"]
    intro = next(s for s in sections if s.get("id") == "doc_intro")
    assert "Opening intro" in intro["body"]
