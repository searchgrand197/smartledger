"""Render complex-script text (e.g. Hindi) for ReportLab PDFs.

ReportLab does not shape Devanagari. Some WhatsApp PDF viewers also show
missing-glyph boxes (■■■) for Indic TrueType text. Pillow uses the OS text
shaper, so Hindi is rasterized as images that display on every client.
"""

from __future__ import annotations

import os
import re
from functools import lru_cache
from io import BytesIO

from reportlab.lib.utils import ImageReader
from reportlab.platypus import Flowable, Paragraph, Spacer

# Devanagari block + common Indic extension marks
_INDIC_RE = re.compile(r"[\u0900-\u097F\uA8E0-\uA8FF\u1CD0-\u1CFF]")
_ZW_RE = re.compile(r"[\u200b\u200c\u200d\ufeff]")
_BULLET_RE = re.compile(r"^[\s•\-\*\u2022\u25cf\u00b7]+")
_NUMBERED_RE = re.compile(r"^(\d+)[\.\)\-:]\s*(.*)$")

# Common Hindi typos seen in shop footers (display-only polish)
_HINDI_FIXES = (
    ("वापिस", "वापस"),
    ("जम्मेवारी", "ज़िम्मेदारी"),
    ("जिम्मेवारी", "ज़िम्मेदारी"),
    ("जम़्मेिेवारी", "ज़िम्मेदारी"),
    ("ग़्राहक", "ग्राहक"),
    ("गराहक", "ग्राहक"),
    ("नही ", "नहीं "),
    ("नही।", "नहीं।"),
    ("नही लिया", "नहीं लिया"),
    ("दनि", "दिन"),
    ("लयििा", "लिया"),
    ("लयिा", "लिया"),
    ("बनि ", "बिना "),
    ("बनिा", "बिना"),
)


def contains_indic(text: str) -> bool:
    return bool(text and _INDIC_RE.search(text))


def polish_hindi_text(text: str) -> str:
    out = text or ""
    for bad, good in _HINDI_FIXES:
        out = out.replace(bad, good)
    return out


def normalize_terms_line(text: str) -> str:
    """Strip invisible chars / bullets and normalize numbered Hindi/English lines."""
    raw = _ZW_RE.sub("", (text or "").strip())
    raw = _BULLET_RE.sub("", raw).strip()
    raw = polish_hindi_text(raw)
    m = _NUMBERED_RE.match(raw)
    if m:
        num, rest = m.group(1), m.group(2).strip()
        return f"{num}. {rest}" if rest else f"{num}."
    return raw


def format_terms_lines(footer_text: str, default_lines: list[str] | None = None) -> list[str]:
    """Split invoice footer into clean display lines (no double bullets)."""
    if not (footer_text or "").strip():
        return list(default_lines or ["Thank you! Quality materials at best rates."])
    lines = []
    for ln in footer_text.split("\n"):
        cleaned = normalize_terms_line(ln)
        if cleaned:
            lines.append(cleaned)
    return lines or list(default_lines or ["Thank you! Quality materials at best rates."])


@lru_cache(maxsize=4)
def _hindi_font_path() -> str | None:
    candidates = [
        os.path.join(os.path.dirname(__file__), "fonts", "NotoSansDevanagari-Regular.ttf"),
        "C:/Windows/Fonts/Nirmala.ttf",
        "C:/Windows/Fonts/nirmala.ttf",
        "C:/Windows/Fonts/mangal.ttf",
        "C:/Windows/Fonts/Mangal.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf",
        "/usr/share/fonts/truetype/lohit-devanagari/Lohit-Devanagari.ttf",
    ]
    for path in candidates:
        if os.path.isfile(path):
            return path
    return None


def _wrap_text(draw, text: str, font, max_width_px: int) -> list[str]:
    words = text.split()
    if not words:
        return [text]
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        trial = f"{current} {word}"
        try:
            width = draw.textlength(trial, font=font)
        except Exception:
            bbox = draw.textbbox((0, 0), trial, font=font)
            width = bbox[2] - bbox[0]
        if width <= max_width_px:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


class ShapedTextBlock(Flowable):
    """Full terms block drawn as one opaque JPEG — WhatsApp-safe Hindi."""

    def __init__(
        self,
        lines: list[str],
        max_width: float,
        *,
        font_size_pt: float = 7.2,
        title_size_pt: float = 7.8,
        line_gap_pt: float = 3.0,
    ):
        super().__init__()
        self.lines = [normalize_terms_line(x) for x in lines if normalize_terms_line(x)]
        self.max_width = max(40.0, float(max_width))
        self.font_size_pt = font_size_pt
        self.title_size_pt = title_size_pt
        self.line_gap_pt = line_gap_pt
        self._img = None
        self._w = self.max_width
        self._h = 12.0
        self._build()

    def _build(self) -> None:
        if not self.lines:
            return
        try:
            from PIL import Image, ImageDraw, ImageFont
        except ImportError:
            return

        font_path = _hindi_font_path()
        if not font_path:
            return

        # High-res render, then scale down into PDF points
        scale = 4
        max_w_px = max(80, int(self.max_width * scale) - 8)
        body_px = max(16, int(round(self.font_size_pt * scale)))
        title_px = max(18, int(round(self.title_size_pt * scale)))
        gap_px = max(4, int(round(self.line_gap_pt * scale)))

        try:
            body_font = ImageFont.truetype(font_path, body_px)
            title_font = ImageFont.truetype(font_path, title_px)
        except OSError:
            return

        probe = Image.new("RGB", (8, 8), "white")
        draw = ImageDraw.Draw(probe)

        # First non-numbered Indic line is treated as title (e.g. नोट :-)
        rendered_rows: list[tuple[str, object]] = []
        for i, line in enumerate(self.lines):
            is_title = i == 0 and not _NUMBERED_RE.match(line) and contains_indic(line)
            font = title_font if is_title else body_font
            for part in _wrap_text(draw, line, font, max_w_px):
                rendered_rows.append((part, font))

        heights: list[int] = []
        widths: list[int] = []
        for text, font in rendered_rows:
            bbox = draw.textbbox((0, 0), text, font=font)
            widths.append(max(1, bbox[2] - bbox[0]))
            heights.append(max(1, bbox[3] - bbox[1]))

        pad_x = 2
        pad_y = 2
        total_h = pad_y * 2 + sum(heights) + gap_px * max(0, len(rendered_rows) - 1)
        total_w = min(max_w_px + pad_x * 2, max(widths) + pad_x * 2)

        img = Image.new("RGB", (total_w, total_h), "white")
        painter = ImageDraw.Draw(img)
        y = pad_y
        for i, (text, font) in enumerate(rendered_rows):
            bbox = painter.textbbox((0, 0), text, font=font)
            # black text on white — opaque JPEG (no transparency mask issues on WhatsApp)
            painter.text((pad_x - bbox[0], y - bbox[1]), text, font=font, fill=(0, 0, 0))
            y += heights[i] + gap_px

        buf = BytesIO()
        # JPEG is more reliable in mobile WhatsApp PDF viewers than PNG+mask
        img.save(buf, format="JPEG", quality=95, optimize=True)
        buf.seek(0)
        self._img = ImageReader(buf)
        self._w = min(self.max_width, img.width / scale)
        self._h = img.height / scale

    @property
    def ok(self) -> bool:
        return self._img is not None

    def wrap(self, availWidth, availHeight):
        if self._img is None:
            return 0, 0
        self._w = min(self._w, availWidth)
        return self._w, self._h

    def draw(self):
        if self._img is None:
            return
        # No mask — keep opaque white background so Hindi never becomes solid black bars
        self.canv.drawImage(self._img, 0, 0, width=self._w, height=self._h, mask=None)


def terms_flowables(
    lines: list[str],
    *,
    style,
    heading_style,
    max_width: float,
    make_paragraph,
    gap: float = 1.5,
) -> list:
    """
    Build terms block.
    If any line is Hindi/Indic, rasterize the whole block as one image (WhatsApp-safe).
    """
    cleaned = [normalize_terms_line(x) for x in lines if normalize_terms_line(x)]
    if not cleaned:
        return []

    if any(contains_indic(x) for x in cleaned):
        block = ShapedTextBlock(
            cleaned,
            max_width=max_width,
            font_size_pt=getattr(style, "fontSize", 7) or 7,
            title_size_pt=getattr(heading_style, "fontSize", 7.5) or 7.5,
            line_gap_pt=2.8,
        )
        if block.ok:
            return [block]
        # Fall through only if Pillow/font unavailable

    out = []
    for i, line in enumerate(cleaned):
        is_title = i == 0 and not _NUMBERED_RE.match(line)
        use_style = heading_style if is_title else style
        esc = (
            line.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )
        if make_paragraph is not None:
            out.append(make_paragraph(esc, use_style, user_content=False))
        else:
            out.append(Paragraph(esc, use_style))
        out.append(Spacer(1, gap))
    if out and isinstance(out[-1], Spacer):
        out.pop()
    return out


def paragraph_or_shaped(
    text: str,
    style,
    *,
    max_width: float,
    user_content: bool = False,
    make_paragraph=None,
    bold: bool = False,
) -> Flowable:
    """Use shaped image block for Indic text; otherwise a normal Paragraph."""
    raw = normalize_terms_line(text) if user_content else ((text or "").strip() or " ")
    if contains_indic(raw):
        block = ShapedTextBlock([raw], max_width=max_width, font_size_pt=style.fontSize)
        if block.ok:
            return block
    if make_paragraph is not None:
        return make_paragraph(raw, style, user_content=user_content)
    esc = raw
    if user_content:
        esc = (
            raw.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )
    return Paragraph(esc.replace("\n", "<br/>"), style)
