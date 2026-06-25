"""Convert .docx to styled HTML for exact mirror rendering on program pages."""
from __future__ import annotations

import html
import re
import zipfile
from dataclasses import dataclass, field
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple
from xml.etree import ElementTree as ET

from utils.docx_import import (
    _W_NS,
    _WP,
    _VAL,
    _STYLE_ID,
    _heading_level,
    _load_style_names,
    _paragraph_alignment,
    _paragraph_is_list,
    _paragraph_style_id,
)

DOCX_HTML_MARKER = "@@DOCX_HTML@@\n"


def is_docx_html_body(body: str) -> bool:
    return str(body or "").startswith(DOCX_HTML_MARKER)


def strip_docx_html_marker(body: str) -> str:
    if is_docx_html_body(body):
        return str(body)[len(DOCX_HTML_MARKER) :]
    return str(body or "")


@dataclass
class _RunStyle:
    font_family: str = "Arial, Helvetica, sans-serif"
    font_size_pt: float = 11.0
    bold: bool = False
    italic: bool = False
    color: str = "#1a1a1a"


@dataclass
class _ParaStyle:
    align: str = "left"
    margin_before_pt: float = 0.0
    margin_after_pt: float = 0.0
    line_height: Optional[float] = None
    run: _RunStyle = field(default_factory=_RunStyle)


def _twips_to_pt(value: str) -> float:
    try:
        return int(value) / 20.0
    except (TypeError, ValueError):
        return 0.0


def _half_points_to_pt(value: str) -> float:
    try:
        return int(value) / 2.0
    except (TypeError, ValueError):
        return 11.0


def _word_color(value: Optional[str]) -> str:
    if not value or value.lower() == "auto":
        return "#1a1a1a"
    if value.lower() == "ffffff":
        return "#ffffff"
    return f"#{value.lower()}"


def _font_family(rfonts: Optional[ET.Element]) -> str:
    if rfonts is None:
        return "Arial, Helvetica, sans-serif"
    name = (
        rfonts.attrib.get(f"{_WP}ascii")
        or rfonts.attrib.get(f"{_WP}hAnsi")
        or rfonts.attrib.get(f"{_WP}cs")
        or "Arial"
    )
    if name.lower() in ("times new roman",):
        return '"Times New Roman", Times, serif'
    if name.lower() in ("georgia",):
        return "Georgia, 'Times New Roman', Times, serif"
    if name.lower() in ("arial",):
        return "Arial, Helvetica, sans-serif"
    return f'"{name}", Arial, Helvetica, sans-serif'


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


def _parse_rpr(rpr: Optional[ET.Element], base: Optional[_RunStyle] = None) -> _RunStyle:
    out = _RunStyle(
        font_family=base.font_family if base else "Arial, Helvetica, sans-serif",
        font_size_pt=base.font_size_pt if base else 11.0,
        bold=base.bold if base else False,
        italic=base.italic if base else False,
        color=base.color if base else "#1a1a1a",
    )
    if rpr is None:
        return out
    rf = rpr.find(f"{_WP}rFonts")
    if rf is not None:
        out.font_family = _font_family(rf)
    sz = rpr.find(f"{_WP}sz")
    if sz is not None and sz.attrib.get(_VAL):
        out.font_size_pt = _half_points_to_pt(sz.attrib.get(_VAL, ""))
    if _run_is_on(rpr, "b"):
        out.bold = True
    if _run_is_on(rpr, "i"):
        out.italic = True
    color = rpr.find(f"{_WP}color")
    if color is not None and color.attrib.get(_VAL):
        out.color = _word_color(color.attrib.get(_VAL))
    return out


def _parse_ppr(ppr: Optional[ET.Element], base: Optional[_ParaStyle] = None) -> _ParaStyle:
    out = _ParaStyle(
        align=base.align if base else "left",
        margin_before_pt=base.margin_before_pt if base else 0.0,
        margin_after_pt=base.margin_after_pt if base else 0.0,
        line_height=base.line_height if base else None,
        run=_parse_rpr(None, base.run if base else None),
    )
    if ppr is None:
        return out
    jc = ppr.find(f"{_WP}jc")
    if jc is not None and jc.attrib.get(_VAL):
        align = _paragraph_alignment_from_val(jc.attrib.get(_VAL, ""))
        if align:
            out.align = align
    spacing = ppr.find(f"{_WP}spacing")
    if spacing is not None:
        if spacing.attrib.get(f"{_WP}before"):
            out.margin_before_pt = _twips_to_pt(spacing.attrib.get(f"{_WP}before", ""))
        if spacing.attrib.get(f"{_WP}after"):
            out.margin_after_pt = _twips_to_pt(spacing.attrib.get(f"{_WP}after", ""))
        line = spacing.attrib.get(f"{_WP}line")
        rule = spacing.attrib.get(f"{_WP}lineRule", "auto")
        if line and rule == "auto":
            try:
                out.line_height = round(int(line) / 240.0, 3)
            except ValueError:
                pass
    rpr = ppr.find(f"{_WP}rPr")
    if rpr is not None:
        out.run = _parse_rpr(rpr, out.run)
    return out


def _paragraph_alignment_from_val(val: str) -> str:
    v = (val or "").strip().lower()
    if v in ("center", "centre"):
        return "center"
    if v == "both":
        return "justify"
    if v == "right":
        return "right"
    return "left"


def _load_doc_defaults(styles_root: ET.Element) -> _RunStyle:
    doc_defaults = styles_root.find(f"{_WP}docDefaults")
    if doc_defaults is None:
        return _RunStyle()
    rpr = doc_defaults.find(f"{_WP}rPrDefault/{_WP}rPr")
    return _parse_rpr(rpr)


def _load_style_map(styles_root: ET.Element, doc_defaults: _RunStyle) -> Dict[str, _ParaStyle]:
    styles: Dict[str, _ParaStyle] = {}
    based_on: Dict[str, str] = {}

    for style in styles_root.iter(f"{_WP}style"):
        sid = style.attrib.get(_STYLE_ID, "")
        if not sid:
            continue
        bo = style.find(f"{_WP}basedOn")
        if bo is not None and bo.attrib.get(_VAL):
            based_on[sid] = bo.attrib.get(_VAL, "")
        ppr = style.find(f"{_WP}pPr")
        rpr = style.find(f"{_WP}rPr")
        para = _parse_ppr(ppr, _ParaStyle(run=doc_defaults))
        if rpr is not None:
            para.run = _parse_rpr(rpr, para.run)
        elif ppr is not None and ppr.find(f"{_WP}rPr") is not None:
            para.run = _parse_rpr(ppr.find(f"{_WP}rPr"), para.run)
        styles[sid] = para

    for sid, parent_id in based_on.items():
        if parent_id in styles and sid in styles:
            parent = styles[parent_id]
            child = styles[sid]
            styles[sid] = _parse_ppr(style_el_ppr(styles_root, sid), _parse_ppr(None, parent))
            if child.run != doc_defaults:
                styles[sid].run = _parse_rpr(style_el_rpr(styles_root, sid), styles[sid].run)

    return styles


def style_el_ppr(styles_root: ET.Element, sid: str) -> Optional[ET.Element]:
    for style in styles_root.iter(f"{_WP}style"):
        if style.attrib.get(_STYLE_ID) == sid:
            return style.find(f"{_WP}pPr")
    return None


def style_el_rpr(styles_root: ET.Element, sid: str) -> Optional[ET.Element]:
    for style in styles_root.iter(f"{_WP}style"):
        if style.attrib.get(_STYLE_ID) == sid:
            rpr = style.find(f"{_WP}rPr")
            if rpr is not None:
                return rpr
            ppr = style.find(f"{_WP}pPr")
            if ppr is not None:
                return ppr.find(f"{_WP}rPr")
    return None


def _run_style_css(style: _RunStyle) -> str:
    parts = [
        f"font-family:{style.font_family}",
        f"font-size:{style.font_size_pt:.2f}pt",
        f"color:{style.color}",
    ]
    if style.bold:
        parts.append("font-weight:700")
    if style.italic:
        parts.append("font-style:italic")
    return ";".join(parts)


def _para_style_css(style: _ParaStyle) -> str:
    parts = [
        f"text-align:{style.align}",
        f"margin-top:{style.margin_before_pt:.2f}pt",
        f"margin-bottom:{style.margin_after_pt:.2f}pt",
    ]
    if style.line_height:
        parts.append(f"line-height:{style.line_height}")
    return ";".join(parts)


def _block_css(para_style: _ParaStyle, *, heading: bool = False) -> str:
    css = _para_style_css(para_style)
    if heading:
        css = f"{css};{_run_style_css(para_style.run)}"
    return css


def _run_text(run: ET.Element) -> str:
    parts: List[str] = []
    for node in run.iter():
        if node.tag == f"{_WP}t" and node.text:
            parts.append(node.text)
        elif node.tag == f"{_WP}tab":
            parts.append("\t")
        elif node.tag in (f"{_WP}br", f"{_WP}cr"):
            parts.append("\n")
    return "".join(parts)


def _runs_to_html(runs: List[ET.Element], para_style: _ParaStyle) -> str:
    chunks: List[str] = []
    for run in runs:
        text = _run_text(run)
        if not text:
            continue
        run_style = _parse_rpr(run.find(f"{_WP}rPr"), para_style.run)
        safe = html.escape(text).replace("\n", "<br/>")
        chunks.append(f'<span style="{_run_style_css(run_style)}">{safe}</span>')
    return "".join(chunks)


def _plain_from_runs(runs: List[ET.Element]) -> str:
    return "".join(_run_text(r) for r in runs).strip()


def _trim_html_preamble(blocks: List[str], heading_flags: List[int]) -> List[str]:
    for i, level in enumerate(heading_flags):
        if level == 1:
            return blocks[i:]
    return blocks


def docx_bytes_to_html(data: bytes, *, trim_preamble: bool = True) -> str:
    """Render document body as HTML with inline Word typography."""
    try:
        with zipfile.ZipFile(BytesIO(data)) as zf:
            xml_bytes = zf.read("word/document.xml")
            styles_bytes = zf.read("word/styles.xml") if "word/styles.xml" in zf.namelist() else None
    except (KeyError, zipfile.BadZipFile) as exc:
        raise ValueError("Invalid or corrupt .docx file") from exc

    style_names = _load_style_names(data)
    styles_root = ET.fromstring(styles_bytes) if styles_bytes else ET.Element(f"{_WP}styles")
    doc_defaults = _load_doc_defaults(styles_root)
    style_map = _load_style_map(styles_root, doc_defaults)

    root = ET.fromstring(xml_bytes)
    body = root.find(f"{_WP}body")
    if body is None:
        raise ValueError("Document is empty")

    html_blocks: List[str] = []
    heading_levels: List[int] = []

    for para in body.findall(f"{_WP}p"):
        runs = para.findall(f"{_WP}r")
        plain = _plain_from_runs(runs)
        if not plain:
            continue

        style_id = _paragraph_style_id(para)
        style_name = style_names.get(style_id, "")
        level = _heading_level(style_name)
        is_list = _paragraph_is_list(para)

        base = style_map.get(style_id, _ParaStyle(run=doc_defaults))
        para_style = _parse_ppr(para.find(f"{_WP}pPr"), base)
        align = _paragraph_alignment(para)
        if align:
            mapped = {"center": "center", "justify": "justify", "right": "right", "left": "left"}.get(align)
            if mapped:
                para_style.align = mapped

        inner = _runs_to_html(runs, para_style)
        if not inner:
            continue

        if level == 1:
            tag = "h1"
            block_css = _block_css(para_style, heading=True)
            heading_levels.append(1)
        elif level == 2:
            tag = "h2"
            block_css = _block_css(para_style, heading=True)
            heading_levels.append(2)
        elif level >= 3:
            tag = "h3"
            block_css = _block_css(para_style, heading=True)
            heading_levels.append(level)
        elif is_list or re.match(r"^[•●○▪\-–—✦]", plain.strip()):
            block_css = f"{_para_style_css(para_style)};{_run_style_css(para_style.run)}"
            bullet_inner = inner
            if plain.strip().startswith("✦"):
                bullet_inner = re.sub(r"^(\s*<span[^>]*>\s*)?✦\s*", "", inner, count=1)
            html_blocks.append(
                f'<p class="docx-bullet" style="{block_css};margin-left:0;padding-left:0">'
                f'<span style="{_run_style_css(para_style.run)}">✦ </span>{bullet_inner}'
                f"</p>"
            )
            heading_levels.append(0)
            continue
        else:
            tag = "p"
            block_css = f"{_para_style_css(para_style)};{_run_style_css(para_style.run)}"
            heading_levels.append(0)

        html_blocks.append(f'<{tag} class="docx-{tag}" style="{block_css}">{inner}</{tag}>')

    if trim_preamble:
        html_blocks = _trim_html_preamble(html_blocks, heading_levels)

    if not html_blocks:
        raise ValueError("Document is empty")

    return (
        '<article class="docx-mirror" style="font-family:Arial,Helvetica,sans-serif;'
        'font-size:11pt;color:#1a1a1a;max-width:100%;">'
        + "".join(html_blocks)
        + "</article>"
    )


def docx_html_document_body(data: bytes) -> str:
    return DOCX_HTML_MARKER + docx_bytes_to_html(data)
