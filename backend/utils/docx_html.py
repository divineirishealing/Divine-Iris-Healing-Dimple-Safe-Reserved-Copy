"""Convert .docx to styled HTML for exact mirror rendering on program pages."""
from __future__ import annotations

import base64
import html
import re
import zipfile
from dataclasses import dataclass, field
from io import BytesIO
from typing import Dict, List, Optional, Tuple
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
_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
_A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
DOCX_ARTICLE_FONT = "'Lato', sans-serif"
DOCX_LANDING_FONT = "Georgia, 'Times New Roman', Times, serif"
_IMAGE_MIME = {
    "png": "image/png",
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "gif": "image/gif",
    "webp": "image/webp",
    "bmp": "image/bmp",
}


def _load_theme_colors(zf: zipfile.ZipFile) -> Dict[str, str]:
    """Read accent / text colors from word/theme/theme1.xml."""
    colors: Dict[str, str] = {}
    path = "word/theme/theme1.xml"
    if path not in zf.namelist():
        return colors
    root = ET.fromstring(zf.read(path))
    scheme = root.find(f".//{{{_A_NS}}}clrScheme")
    if scheme is None:
        return colors
    for child in scheme:
        local = child.tag.split("}")[-1]
        srgb = child.find(f"{{{_A_NS}}}srgbClr")
        if srgb is not None and srgb.attrib.get("val"):
            colors[local] = f"#{srgb.attrib['val'].lower()}"
            continue
        sysclr = child.find(f"{{{_A_NS}}}sysClr")
        if sysclr is not None and sysclr.attrib.get("lastClr"):
            colors[local] = f"#{sysclr.attrib['lastClr'].lower()}"
    return colors


def _color_from_element(color_el: ET.Element, theme: Dict[str, str], fallback: str) -> str:
    val = (color_el.attrib.get(_VAL) or "").strip()
    if val and val.lower() not in ("auto",):
        return _word_color(val)
    theme_key = color_el.attrib.get(f"{_WP}themeColor")
    if theme_key and theme_key in theme:
        return theme[theme_key]
    return fallback


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
    if name.lower() in ("lato",):
        return "'Lato', sans-serif"
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


def _parse_rpr(
    rpr: Optional[ET.Element],
    base: Optional[_RunStyle] = None,
    theme: Optional[Dict[str, str]] = None,
) -> _RunStyle:
    theme = theme or {}
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
    if color is not None:
        out.color = _color_from_element(color, theme, out.color)
    return out


def _parse_ppr(
    ppr: Optional[ET.Element],
    base: Optional[_ParaStyle] = None,
    theme: Optional[Dict[str, str]] = None,
) -> _ParaStyle:
    theme = theme or {}
    out = _ParaStyle(
        align=base.align if base else "left",
        margin_before_pt=base.margin_before_pt if base else 0.0,
        margin_after_pt=base.margin_after_pt if base else 0.0,
        line_height=base.line_height if base else None,
        run=_parse_rpr(None, base.run if base else None, theme),
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
        out.run = _parse_rpr(rpr, out.run, theme)
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


def _load_doc_defaults(styles_root: ET.Element, theme: Optional[Dict[str, str]] = None) -> _RunStyle:
    doc_defaults = styles_root.find(f"{_WP}docDefaults")
    if doc_defaults is None:
        return _RunStyle()
    rpr = doc_defaults.find(f"{_WP}rPrDefault/{_WP}rPr")
    return _parse_rpr(rpr, theme=theme)


def _load_style_map(
    styles_root: ET.Element,
    doc_defaults: _RunStyle,
    theme: Optional[Dict[str, str]] = None,
) -> Dict[str, _ParaStyle]:
    theme = theme or {}
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
        para = _parse_ppr(ppr, _ParaStyle(run=doc_defaults), theme)
        if rpr is not None:
            para.run = _parse_rpr(rpr, para.run, theme)
        elif ppr is not None and ppr.find(f"{_WP}rPr") is not None:
            para.run = _parse_rpr(ppr.find(f"{_WP}rPr"), para.run, theme)
        styles[sid] = para

    for sid, parent_id in based_on.items():
        if parent_id in styles and sid in styles:
            parent = styles[parent_id]
            styles[sid] = _parse_ppr(style_el_ppr(styles_root, sid), _parse_ppr(None, parent, theme), theme)
            if styles[sid].run != doc_defaults:
                styles[sid].run = _parse_rpr(style_el_rpr(styles_root, sid), styles[sid].run, theme)

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


def _run_span_html(run_style: _RunStyle, text: str) -> str:
    safe = html.escape(text).replace("\n", "<br/>")
    return f'<span style="{_run_style_css(run_style)}">{safe}</span>'


def _runs_to_html(runs: List[ET.Element], para_style: _ParaStyle, theme: Optional[Dict[str, str]] = None) -> str:
    theme = theme or {}
    chunks: List[str] = []
    for run in runs:
        text = _run_text(run)
        if not text:
            continue
        run_style = _parse_rpr(run.find(f"{_WP}rPr"), para_style.run, theme)
        chunks.append(_run_span_html(run_style, text))
    return "".join(chunks)


def _paragraph_rule_html(ppr: Optional[ET.Element], para_style: _ParaStyle) -> str:
    """Horizontal rule from Word paragraph bottom border."""
    if ppr is None:
        return ""
    pb = ppr.find(f"{_WP}pBdr")
    if pb is None:
        return ""
    bottom = pb.find(f"{_WP}bottom")
    if bottom is None:
        return ""
    val = (bottom.attrib.get(_VAL) or "").lower()
    if val in ("", "none", "nil"):
        return ""
    try:
        width_pt = int(bottom.attrib.get(f"{_WP}sz", "4")) / 8.0
    except (TypeError, ValueError):
        width_pt = 0.5
    color = _word_color(bottom.attrib.get(f"{_WP}color", "C9962A"))
    margin = (
        f"margin-top:{para_style.margin_before_pt:.2f}pt;"
        f"margin-bottom:{para_style.margin_after_pt:.2f}pt;"
    )
    return (
        f'<div class="docx-rule-wrap" style="{margin}">'
        f'<hr class="docx-rule" style="border:none;border-bottom:{width_pt:.2f}pt solid {color};'
        f'width:100%;margin:0;padding:0;" />'
        f"</div>"
    )


def _spacer_html(para_style: _ParaStyle) -> str:
    if para_style.margin_before_pt <= 0 and para_style.margin_after_pt <= 0:
        return ""
    return (
        f'<div class="docx-spacer" aria-hidden="true" '
        f'style="margin-top:{para_style.margin_before_pt:.2f}pt;'
        f'margin-bottom:{para_style.margin_after_pt:.2f}pt"></div>'
    )


def _plain_from_runs(runs: List[ET.Element]) -> str:
    return "".join(_run_text(r) for r in runs).strip()


def _smart_bullet_html(para_style: _ParaStyle, plain: str, inner: str) -> str:
    text = re.sub(r"^[✦•●○▪\-–—\s]+", "", plain).strip()
    block_css = f"{_para_style_css(para_style)};{_run_style_css(para_style.run)}"
    m = re.match(r"^(.+?)\s*[—–]\s*(.+)$", text)
    if m:
        title, desc = m.group(1).strip(), m.group(2).strip()
        return (
            f'<p class="docx-bullet docx-bullet-split" style="{block_css};margin-left:0;padding-left:0">'
            f'<span class="docx-bullet-mark" aria-hidden="true">✦</span> '
            f'<span class="docx-item-title">{html.escape(title)}</span>'
            f'<span class="docx-item-sep"> — </span>'
            f'<span class="docx-item-desc">{html.escape(desc)}</span>'
            f"</p>"
        )
    return (
        f'<p class="docx-bullet" style="{block_css};margin-left:0;padding-left:0">'
        f'<span class="docx-bullet-mark" aria-hidden="true">✦</span> {inner}'
        f"</p>"
    )


def _tag_quote_paragraph(block: str) -> str:
    if "class=\"docx-p\"" not in block:
        return block
    lower = block.lower()
    if "text-align:center" in lower.replace(" ", "") and "italic" in lower:
        return block.replace('class="docx-p"', 'class="docx-p docx-word-quote"', 1)
    if "text-align:center" in lower.replace(" ", "") and ('"' in block or "&#x27;" in block):
        return block.replace('class="docx-p"', 'class="docx-p docx-word-quote"', 1)
    return block


def _wrap_section(block: str, level: int) -> str:
    if level == 1:
        return f'<div class="docx-section-major"><div class="docx-section-major-inner">{block}</div></div>'
    if level >= 2:
        return f'<div class="docx-section-minor"><div class="docx-section-minor-inner">{block}</div></div>'
    return block


def _structure_document_html(
    blocks: List[str],
    aligns: List[str],
    headings: List[int],
) -> List[str]:
    """Group cover, intro, and highlight section headings for the live landing layout."""
    n = len(blocks)
    first_justify = next(
        (i for i in range(n) if i < len(aligns) and aligns[i] == "justify" and headings[i] == 0),
        None,
    )
    first_h1 = next((i for i in range(n) if headings[i] == 1), None)

    out: List[str] = []
    cover_open = intro_open = False

    for i, block in enumerate(blocks):
        level = headings[i] if i < len(headings) else 0
        align = aligns[i] if i < len(aligns) else ""

        if i == 0 and first_justify and first_justify > 0:
            out.append('<div class="docx-cover-stage">')
            cover_open = True

        if i == first_justify and cover_open:
            out.append("</div>")
            cover_open = False
            out.append('<div class="docx-intro-body">')
            intro_open = True

        if i == first_h1 and intro_open:
            out.append("</div>")
            intro_open = False

        if level >= 1:
            out.append(_wrap_section(block, level))
        elif "docx-bullet" in block:
            out.append(block)
        elif align == "center" and "docx-p" in block:
            out.append(_tag_quote_paragraph(block))
        else:
            out.append(block)

    if intro_open:
        out.append("</div>")
    if cover_open:
        out.append("</div>")

    return out


def _trim_cover_preamble(
    blocks: List[str],
    aligns: List[str],
    heading_levels: List[int],
) -> List[str]:
    """Drop centered cover/tagline lines only; keep intro body before the first Heading 1."""
    i = 0
    while i < len(blocks):
        if heading_levels[i] >= 1:
            break
        if aligns[i] in ("justify", "left", "right"):
            break
        if aligns[i] == "center":
            i += 1
            continue
        break
    return blocks[i:]


def _load_relationships(zf: zipfile.ZipFile) -> Dict[str, str]:
    rels: Dict[str, str] = {}
    path = "word/_rels/document.xml.rels"
    if path not in zf.namelist():
        return rels
    root = ET.fromstring(zf.read(path))
    for rel in root:
        rid = rel.attrib.get("Id")
        target = rel.attrib.get("Target")
        if rid and target:
            rels[rid] = target
    return rels


def _resolve_media_path(target: str) -> str:
    cleaned = target.replace("\\", "/")
    if cleaned.startswith("/"):
        return cleaned.lstrip("/")
    if cleaned.startswith("word/"):
        return cleaned
    return f"word/{cleaned.replace('../', '')}"


def _image_html_for_embed(embed_id: str, zf: zipfile.ZipFile, rels: Dict[str, str]) -> str:
    target = rels.get(embed_id)
    if not target:
        return ""
    path = _resolve_media_path(target)
    if path not in zf.namelist():
        alt = path.replace("word/", "")
        if alt in zf.namelist():
            path = alt
        else:
            return ""
    ext = path.rsplit(".", 1)[-1].lower()
    mime = _IMAGE_MIME.get(ext)
    if not mime:
        return ""
    data = zf.read(path)
    b64 = base64.b64encode(data).decode("ascii")
    return (
        f'<img class="docx-image" alt="" src="data:{mime};base64,{b64}" '
        f'style="max-width:100%;height:auto;display:block;margin:0 auto;" />'
    )


def _images_html_from_para(para: ET.Element, zf: zipfile.ZipFile, rels: Dict[str, str]) -> str:
    parts: List[str] = []
    seen: set[str] = set()
    for el in para.iter():
        embed = el.attrib.get(f"{{{_REL_NS}}}embed")
        if not embed or embed in seen:
            continue
        seen.add(embed)
        img = _image_html_for_embed(embed, zf, rels)
        if img:
            parts.append(img)
    return "".join(parts)


def _para_shading_css(ppr: Optional[ET.Element]) -> str:
    if ppr is None:
        return ""
    shd = ppr.find(f"{_WP}shd")
    if shd is None:
        return ""
    fill = shd.attrib.get(f"{_WP}fill") or shd.attrib.get("fill", "")
    if not fill or fill.lower() in ("auto", "none", "ffffff"):
        return ""
    return f"background-color:{_word_color(fill)};"


def _infer_heading_level(
    runs: List[ET.Element],
    plain: str,
    style_level: int,
    para_style: _ParaStyle,
    theme: Optional[Dict[str, str]] = None,
) -> int:
    theme = theme or {}
    if style_level > 0:
        return style_level
    text = plain.strip()
    if not text or len(text) > 120:
        return 0
    if text.endswith(".") and len(text.split()) > 8:
        return 0

    bold_chars = 0
    total_chars = 0
    max_size = para_style.run.font_size_pt
    purple_chars = 0
    for run in runs:
        chunk = _run_text(run)
        stripped = chunk.strip()
        if not stripped:
            continue
        total_chars += len(stripped)
        run_style = _parse_rpr(run.find(f"{_WP}rPr"), para_style.run, theme)
        if run_style.bold:
            bold_chars += len(stripped)
        max_size = max(max_size, run_style.font_size_pt)
        color = (run_style.color or "").lower()
        if color not in ("#1a1a1a", "#1a1a2e", "#000000", "#374151") and color.startswith("#"):
            purple_chars += len(stripped)

    if total_chars == 0:
        return 0
    if bold_chars >= total_chars * 0.75 or purple_chars >= total_chars * 0.75:
        if max_size >= 16:
            return 1
        return 2
    return 0


def _append_html_block(
    html_blocks: List[str],
    heading_levels: List[int],
    align_flags: List[str],
    block: str,
    level: int,
    align: str,
) -> None:
    html_blocks.append(block)
    heading_levels.append(level)
    align_flags.append(align)


def docx_bytes_to_html(data: bytes, *, trim_preamble: bool = False, landing: bool = True) -> str:
    """Render the full document body as HTML with inline Word typography."""
    try:
        zf = zipfile.ZipFile(BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise ValueError("Invalid or corrupt .docx file") from exc

    with zf:
        try:
            xml_bytes = zf.read("word/document.xml")
            styles_bytes = zf.read("word/styles.xml") if "word/styles.xml" in zf.namelist() else None
        except KeyError as exc:
            raise ValueError("Invalid or corrupt .docx file") from exc

        rels = _load_relationships(zf)
        theme = _load_theme_colors(zf)
        style_names = _load_style_names(data)
        styles_root = ET.fromstring(styles_bytes) if styles_bytes else ET.Element(f"{_WP}styles")
        doc_defaults = _load_doc_defaults(styles_root, theme)
        style_map = _load_style_map(styles_root, doc_defaults, theme)

        root = ET.fromstring(xml_bytes)
        body = root.find(f"{_WP}body")
        if body is None:
            raise ValueError("Document is empty")

        html_blocks: List[str] = []
        heading_levels: List[int] = []
        align_flags: List[str] = []

        for para in body.findall(f"{_WP}p"):
            runs = para.findall(f"{_WP}r")
            plain = _plain_from_runs(runs)
            ppr = para.find(f"{_WP}pPr")
            images_html = _images_html_from_para(para, zf, rels)

            style_id = _paragraph_style_id(para)
            style_name = style_names.get(style_id, "")
            level = _heading_level(style_name)
            is_list = _paragraph_is_list(para)

            base = style_map.get(style_id, _ParaStyle(run=doc_defaults))
            para_style = _parse_ppr(ppr, base, theme)
            align = _paragraph_alignment(para)
            if align:
                mapped = {"center": "center", "justify": "justify", "right": "right", "left": "left"}.get(align)
                if mapped:
                    para_style.align = mapped

            shading_css = _para_shading_css(ppr)

            if not plain and not images_html:
                rule = _paragraph_rule_html(ppr, para_style)
                if rule:
                    _append_html_block(html_blocks, heading_levels, align_flags, rule, 0, para_style.align)
                else:
                    spacer = _spacer_html(para_style)
                    if spacer:
                        _append_html_block(html_blocks, heading_levels, align_flags, spacer, 0, para_style.align)
                continue

            if not plain and images_html:
                block_css = f"{_para_style_css(para_style)};{shading_css}".strip(";")
                block = f'<div class="docx-figure" style="{block_css}">{images_html}</div>'
                _append_html_block(html_blocks, heading_levels, align_flags, block, 0, para_style.align)
                continue

            level = _infer_heading_level(runs, plain, level, para_style, theme)
            inner = _runs_to_html(runs, para_style, theme)
            if images_html:
                inner = f"{images_html}{inner}"
            if not inner:
                continue

            if level == 1:
                tag = "h1"
                block_css = _block_css(para_style, heading=True)
                heading_level = 1
            elif level == 2:
                tag = "h2"
                block_css = _block_css(para_style, heading=True)
                heading_level = 2
            elif level >= 3:
                tag = "h3"
                block_css = _block_css(para_style, heading=True)
                heading_level = level
            elif is_list or re.match(r"^[•●○▪\-–—✦]", plain.strip()):
                _append_html_block(
                    html_blocks,
                    heading_levels,
                    align_flags,
                    _smart_bullet_html(para_style, plain, inner),
                    0,
                    para_style.align,
                )
                continue
            else:
                tag = "p"
                block_css = f"{_para_style_css(para_style)};{_run_style_css(para_style.run)}"
                heading_level = 0

            if shading_css:
                block_css = f"{block_css};{shading_css}"
            block = f'<{tag} class="docx-{tag}" style="{block_css}">{inner}</{tag}>'
            _append_html_block(html_blocks, heading_levels, align_flags, block, heading_level, para_style.align)

    if trim_preamble:
        html_blocks = _trim_cover_preamble(html_blocks, align_flags, heading_levels)

    if landing:
        html_blocks = _structure_document_html(html_blocks, align_flags, heading_levels)

    if not html_blocks:
        raise ValueError("Document is empty")

    mirror_class = "docx-mirror-landing" if landing else "docx-mirror-article"
    mirror_font = DOCX_LANDING_FONT if landing else DOCX_ARTICLE_FONT
    return (
        f'<article class="docx-mirror {mirror_class}" '
        f'style="font-family:{mirror_font};'
        'font-size:11pt;color:#1a1a2e;line-height:1.45;width:100%;">'
        + "".join(html_blocks)
        + "</article>"
    )


def docx_html_document_body(data: bytes, *, landing: bool = True) -> str:
    return DOCX_HTML_MARKER + docx_bytes_to_html(data, landing=landing)
