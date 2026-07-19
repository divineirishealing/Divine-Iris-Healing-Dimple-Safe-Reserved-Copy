"""Tests for docx → HTML mirror export."""
from pathlib import Path

from utils.docx_html import DOCX_HTML_MARKER, docx_bytes_to_html, docx_html_document_body, is_docx_html_body
from utils.docx_import import build_draft_sections_from_docx


def test_docx_html_marker():
    body = docx_html_document_body(_minimal_docx())
    assert is_docx_html_body(body)
    assert body.startswith(DOCX_HTML_MARKER)
    assert "docx-mirror" in body


def test_heading_uses_georgia_and_color():
    html = docx_bytes_to_html(_minimal_docx())
    assert "Georgia" in html
    assert "#2a1f5e" in html.lower() or "#2A1F5E".lower() in html.lower()


def test_article_mode_skips_landing_structure():
    html = docx_bytes_to_html(_minimal_docx(), landing=False)
    assert "docx-mirror-article" in html
    assert "docx-cover-stage" not in html
    assert "docx-section-major" not in html
    assert "Lato" in html


def test_theme_color_resolved_in_html():
    html = docx_bytes_to_html(_docx_with_theme_color())
    assert "4472c4" in html.lower() or "#4472C4".lower() in html.lower()


def test_amrp_fixture_html_matches_full_word_document():
    src = Path(__file__).resolve().parent / "fixtures" / "AMRP_Program_Writeup.docx"
    if not src.exists():
        import pytest
        pytest.skip("AMRP fixture doc not on this machine")

    html = docx_bytes_to_html(src.read_bytes())
    assert "Divine Iris Healing" in html
    assert "Atomic Musculoskeletal" in html
    assert "AMRP" in html
    assert "docx-cover-stage" in html
    assert "docx-section-major" in html
    assert "docx-item-title" in html
    assert "#c9962a" in html.lower()
    assert "Every day, millions of people" in html
    assert "What Is the Atomic Musculoskeletal Regeneration Program?" in html
    assert "Georgia" in html
    assert "Osteoarthritis" in html
    assert "text-align:center" in html.replace(" ", "")


def test_build_draft_sections_stores_html_body():
    src = Path(__file__).resolve().parent / "fixtures" / "AMRP_Program_Writeup.docx"
    if not src.exists():
        import pytest
        pytest.skip("AMRP fixture doc not on this machine")

    sections = build_draft_sections_from_docx(src.read_bytes())
    doc = next(s for s in sections if s["id"] == "doc_main")
    assert is_docx_html_body(doc["body"])
    assert doc.get("subtitle") == "docx-html"


def _docx_with_theme_color():
    import zipfile
    from io import BytesIO

    inner = (
        '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>'
        '<w:r><w:rPr>'
        '<w:rFonts w:ascii="Lato" w:hAnsi="Lato"/>'
        '<w:color w:val="auto" w:themeColor="accent1"/>'
        '<w:sz w:val="32"/><w:b/>'
        '</w:rPr><w:t>Purple Theme Title</w:t></w:r></w:p>'
    )
    xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{inner}</w:body></w:document>"
    )
    styles = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:docDefaults><w:rPrDefault><w:rPr>'
        '<w:rFonts w:ascii="Lato" w:hAnsi="Lato"/><w:sz w:val="22"/>'
        '</w:rPr></w:rPrDefault></w:docDefaults>'
        '<w:style w:type="paragraph" w:styleId="Heading1">'
        '<w:name w:val="heading 1"/>'
        '<w:rPr><w:rFonts w:ascii="Lato" w:hAnsi="Lato"/>'
        '<w:color w:val="auto" w:themeColor="accent1"/>'
        '<w:sz w:val="32"/><w:b/></w:rPr></w:style></w:styles>'
    )
    theme = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">'
        '<a:themeElements><a:clrScheme name="Office">'
        '<a:accent1><a:srgbClr val="4472C4"/></a:accent1>'
        '</a:clrScheme></a:themeElements></a:theme>'
    )
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("word/document.xml", xml)
        zf.writestr("word/styles.xml", styles)
        zf.writestr("word/theme/theme1.xml", theme)
    return buf.getvalue()


def _minimal_docx():
    import zipfile
    from io import BytesIO

    inner = (
        '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>'
        '<w:r><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/>'
        '<w:sz w:val="38"/><w:color w:val="2A1F5E"/><w:b/></w:rPr>'
        '<w:t>Program Title</w:t></w:r></w:p>'
        '<w:p><w:pPr><w:jc w:val="both"/></w:pPr>'
        '<w:r><w:t>Body paragraph text.</w:t></w:r></w:p>'
    )
    xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{inner}</w:body></w:document>"
    )
    styles = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        '<w:docDefaults><w:rPrDefault><w:rPr>'
        '<w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/>'
        '</w:rPr></w:rPrDefault></w:docDefaults>'
        '<w:style w:type="paragraph" w:styleId="Heading1">'
        '<w:name w:val="heading 1"/>'
        '<w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/>'
        '<w:sz w:val="38"/><w:color w:val="2A1F5E"/><w:b/>'
        '</w:rPr></w:style></w:styles>'
    )
    buf = BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("word/document.xml", xml)
        zf.writestr("word/styles.xml", styles)
    return buf.getvalue()
