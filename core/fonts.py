import os
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.fonts import addMapping

FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

# Devanagari-only faces (e.g. Noto Sans Devanagari) must NOT be used as the
# document body font — they lack Latin glyphs and blank out English labels.
_DEVANAGARI_ONLY = {
    "notosansdevanagari",
}


def setup_fonts():
    """Register a Unicode TTF with Latin coverage for general PDF text.

    Hindi/Devanagari in invoice footers is rasterized separately in
    ``core.unicode_text`` (WhatsApp-safe). Do not register Devanagari-only
    fonts here.
    """
    global FONT_REGULAR, FONT_BOLD
    bundled = os.path.join(os.path.dirname(__file__), "fonts")
    paths = [
        (
            os.path.join(bundled, "NotoSans-Regular.ttf"),
            os.path.join(bundled, "NotoSans-Bold.ttf"),
            "NotoSans",
        ),
        (
            os.path.join(bundled, "DejaVuSans.ttf"),
            os.path.join(bundled, "DejaVuSans-Bold.ttf"),
            "DejaVuSans",
        ),
        ("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf", "ArialUnicode"),
        ("C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/segoeuib.ttf", "SegoeUI"),
    ]
    for reg, bold, family in paths:
        if family.lower() in _DEVANAGARI_ONLY:
            continue
        if not os.path.exists(reg):
            continue
        bold_path = bold if os.path.exists(bold) else reg
        try:
            pdfmetrics.registerFont(TTFont(family, reg))
            bold_name = f"{family}-Bold"
            pdfmetrics.registerFont(TTFont(bold_name, bold_path))
            addMapping(family, 0, 0, family)
            addMapping(family, 1, 0, bold_name)
            FONT_REGULAR = family
            FONT_BOLD = bold_name
            break
        except Exception:
            continue


setup_fonts()
