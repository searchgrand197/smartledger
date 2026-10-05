"""Render complex-script text (e.g. Hindi) for ReportLab PDFs.

ReportLab does not shape Devanagari. Some WhatsApp PDF viewers also show
missing-glyph boxes (■■■) for Indic TrueType text. Hindi is therefore
rasterized as an opaque JPEG using HarfBuzz + FreeType (with a Pillow
fallback) so it displays correctly on every client.
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
        "C:/Windows/Fonts/Nirmala.ttc",
        "C:/Windows/Fonts/nirmala.ttc",
        "C:/Windows/Fonts/mangal.ttf",
        "C:/Windows/Fonts/Mangal.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf",
        "/usr/share/fonts/truetype/lohit-devanagari/Lohit-Devanagari.ttf",
    ]
    for path in candidates:
        if os.path.isfile(path):
            return path
    return None


def _font_load_kwargs(font_path: str) -> dict:
    """Pillow needs an explicit face index for TrueType Collections (.ttc)."""
    if font_path.lower().endswith(".ttc"):
        return {"index": 0}
    return {}


def _wrap_text_width(text: str, measure, max_width_px: int) -> list[str]:
    words = text.split()
    if not words:
        return [text]
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        trial = f"{current} {word}"
        if measure(trial) <= max_width_px:
            current = trial
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def _render_line_harfbuzz(text: str, font_path: str, size_px: int):
    """Shape + rasterize one line with HarfBuzz/FreeType. Returns RGB image or None."""
    try:
        import uharfbuzz as hb
        from freetype import Face, FT_LOAD_RENDER
    except ImportError:
        return None

    try:
        face = Face(font_path)
        face.set_char_size(size_px * 64)
        with open(font_path, "rb") as fh:
            blob = fh.read()
        hb_face = hb.Face(blob)
        hb_font = hb.Font(hb_face)
        # Prefer ppem-based scale (stable across FreeType builds)
        try:
            hb_font.scale = (int(face.size.x_ppem) * 64, int(face.size.y_ppem) * 64)
        except Exception:
            hb_font.scale = (size_px * 64, size_px * 64)

        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(hb_font, buf)
        infos = buf.glyph_infos
        positions = buf.glyph_positions
        if not infos:
            return None

        from PIL import Image

        width = max(1, int(sum(p.x_advance for p in positions) / 64) + 6)
        height = max(size_px * 2, int(size_px * 1.8) + 4)
        img = Image.new("L", (width, height), 255)
        pixels = img.load()

        pen_x = 2 * 64
        pen_y = int(size_px * 1.25) * 64
        for info, pos in zip(infos, positions):
            face.load_glyph(info.codepoint, FT_LOAD_RENDER)
            bitmap = face.glyph.bitmap
            w, h = bitmap.width, bitmap.rows
            if w and h and bitmap.buffer:
                glyph_img = Image.frombytes("L", (w, h), bytes(bitmap.buffer))
                x = (pen_x + pos.x_offset) // 64 + face.glyph.bitmap_left
                y = (pen_y - pos.y_offset) // 64 - face.glyph.bitmap_top
                for gy in range(h):
                    for gx in range(w):
                        px, py = x + gx, y + gy
                        if 0 <= px < width and 0 <= py < height:
                            cov = glyph_img.getpixel((gx, gy))
                            cur = pixels[px, py]
                            pixels[px, py] = max(0, cur - cov)
            pen_x += pos.x_advance
            pen_y += pos.y_advance

        # Trim excess whitespace but keep a 1px pad
        bbox = img.getbbox()
        if bbox:
            left, top, right, bottom = bbox
            img = img.crop(
                (
                    max(0, left - 1),
                    max(0, top - 1),
                    min(width, right + 1),
                    min(height, bottom + 1),
                )
            )
        return Image.merge("RGB", (img, img, img))
    except Exception:
        return None


def _measure_line_harfbuzz(text: str, font_path: str, size_px: int) -> int | None:
    try:
        import uharfbuzz as hb
        from freetype import Face
    except ImportError:
        return None
    try:
        face = Face(font_path)
        face.set_char_size(size_px * 64)
        with open(font_path, "rb") as fh:
            blob = fh.read()
        hb_face = hb.Face(blob)
        hb_font = hb.Font(hb_face)
        try:
            hb_font.scale = (int(face.size.x_ppem) * 64, int(face.size.y_ppem) * 64)
        except Exception:
            hb_font.scale = (size_px * 64, size_px * 64)
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(hb_font, buf)
        return max(1, int(sum(p.x_advance for p in buf.glyph_positions) / 64))
    except Exception:
        return None


def _render_line_pillow(text: str, font_path: str, size_px: int):
    """Fallback rasterize without complex shaping (may misplace matras)."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return None
    try:
        font = ImageFont.truetype(font_path, size_px, **_font_load_kwargs(font_path))
    except OSError:
        return None
    probe = Image.new("RGB", (8, 8), "white")
    draw = ImageDraw.Draw(probe)
    bbox = draw.textbbox((0, 0), text, font=font)
    w = max(1, bbox[2] - bbox[0] + 4)
    h = max(1, bbox[3] - bbox[1] + 4)
    img = Image.new("RGB", (w, h), "white")
    painter = ImageDraw.Draw(img)
    painter.text((2 - bbox[0], 2 - bbox[1]), text, font=font, fill=(0, 0, 0))
    return img


def _render_line(text: str, font_path: str, size_px: int):
    img = _render_line_harfbuzz(text, font_path, size_px)
    if img is not None:
        return img
    return _render_line_pillow(text, font_path, size_px)


def _measure_line(text: str, font_path: str, size_px: int) -> int:
    w = _measure_line_harfbuzz(text, font_path, size_px)
    if w is not None:
        return w
    try:
        from PIL import Image, ImageDraw, ImageFont
        font = ImageFont.truetype(font_path, size_px, **_font_load_kwargs(font_path))
        draw = ImageDraw.Draw(Image.new("RGB", (8, 8), "white"))
        try:
            return int(draw.textlength(text, font=font))
        except Exception:
            bbox = draw.textbbox((0, 0), text, font=font)
            return max(1, bbox[2] - bbox[0])
    except Exception:
        return max(1, len(text) * size_px // 2)


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

        font_path = _hindi_font_path()
        if not font_path:
            return

        # High-res render, then scale down into PDF points
        scale = 4
        max_w_px = max(80, int(self.max_width * scale) - 8)
        body_px = max(16, int(round(self.font_size_pt * scale)))
        title_px = max(18, int(round(self.title_size_pt * scale)))
        gap_px = max(4, int(round(self.line_gap_pt * scale)))

        rendered_rows: list[tuple[str, int]] = []
        for i, line in enumerate(self.lines):
            is_title = i == 0 and not _NUMBERED_RE.match(line) and contains_indic(line)
            size_px = title_px if is_title else body_px
            for part in _wrap_text_width(
                line,
                lambda t, sp=size_px: _measure_line(t, font_path, sp),
                max_w_px,
            ):
                rendered_rows.append((part, size_px))

        row_images = []
        for text, size_px in rendered_rows:
            row_img = _render_line(text, font_path, size_px)
            if row_img is None:
                return
            row_images.append(row_img)

        from PIL import Image

        pad_x = 2
        pad_y = 2
        total_w = min(
            max_w_px + pad_x * 2,
            max(im.width for im in row_images) + pad_x * 2,
        )
        total_h = (
            pad_y * 2
            + sum(im.height for im in row_images)
            + gap_px * max(0, len(row_images) - 1)
        )

        img = Image.new("RGB", (total_w, total_h), "white")
        y = pad_y
        for i, row_img in enumerate(row_images):
            img.paste(row_img, (pad_x, y))
            y += row_img.height + gap_px

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
