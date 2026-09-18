import os
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.fonts import addMapping

FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"


def setup_fonts():
    """Register a Unicode TTF so Latin + Devanagari can embed in PDFs."""
    global FONT_REGULAR, FONT_BOLD
    bundled = os.path.join(os.path.dirname(__file__), "fonts")
    paths = [
        (
            os.path.join(bundled, "NotoSansDevanagari-Regular.ttf"),
            os.path.join(bundled, "NotoSansDevanagari-Bold.ttf"),
            "NotoSansDevanagari",
        ),
        ("C:/Windows/Fonts/Nirmala.ttf", "C:/Windows/Fonts/NirmalaB.ttf", "Nirmala"),
        ("C:/Windows/Fonts/nirmala.ttf", "C:/Windows/Fonts/nirmalab.ttf", "Nirmala"),
        ("C:/Windows/Fonts/mangal.ttf", "C:/Windows/Fonts/mangal.ttf", "Mangal"),
    ]
    for reg, bold, family in paths:
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
