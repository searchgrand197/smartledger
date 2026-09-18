from decimal import Decimal
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from core.fonts import FONT_REGULAR, FONT_BOLD


def _fmt_money(value) -> str:
    return f"{Decimal(str(value or 0)):,.2f}"


def build_pdf(title: str, subtitle: str, headers: list, rows: list, footer: str = "") -> BytesIO:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=15 * mm, leftMargin=15 * mm)
    styles = getSampleStyleSheet()
    styles["Title"].fontName = FONT_BOLD
    styles["Normal"].fontName = FONT_REGULAR
    
    story = [
        Paragraph(title, styles["Title"]),
        Paragraph(subtitle, styles["Normal"]),
        Spacer(1, 12),
    ]
    table_data = [headers] + rows
    table = Table(table_data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1565c0")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, -1), FONT_REGULAR),
                ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f7ff")]),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ]
        )
    )
    story.append(table)
    if footer:
        story.append(Spacer(1, 12))
        story.append(Paragraph(footer, ParagraphStyle(name="Footer", fontName=FONT_REGULAR, fontSize=8)))
    doc.build(story)
    buffer.seek(0)
    return buffer


def build_ledger_pdf(
    title: str,
    party_name: str,
    party_lines: list[str],
    summary: dict,
    entries: list[dict],
    footer: str = "",
) -> BytesIO:
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=12 * mm, leftMargin=12 * mm)
    styles = getSampleStyleSheet()
    styles["Title"].fontName = FONT_BOLD
    styles["Normal"].fontName = FONT_REGULAR
    styles["Heading2"].fontName = FONT_BOLD
    
    story = [
        Paragraph(title, ParagraphStyle(name="LedgerTitle", parent=styles["Title"], fontName=FONT_BOLD, textColor=colors.HexColor("#1565c0"))),
        Paragraph(party_name, styles["Heading2"]),
    ]
    for line in party_lines:
        story.append(Paragraph(line, styles["Normal"]))
    story.append(Spacer(1, 10))

    summary_table = Table(
        [
            ["Opening Balance", "Total Debit", "Total Credit", "Closing Balance"],
            [
                _fmt_money(summary.get("opening_balance", 0)),
                _fmt_money(summary.get("total_debit", 0)),
                _fmt_money(summary.get("total_credit", 0)),
                _fmt_money(summary.get("closing_balance", 0)),
            ],
        ],
        colWidths=[45 * mm, 45 * mm, 45 * mm, 45 * mm],
    )
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1565c0")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, -1), FONT_REGULAR),
                ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
                ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#e3f2fd")),
                ("FONTNAME", (0, 1), (-1, 1), FONT_BOLD),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#1565c0")),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#90caf9")),
            ]
        )
    )
    story.append(summary_table)
    story.append(Spacer(1, 14))

    headers = ["#", "Date", "Description", "Bill No", "Debit", "Credit", "Balance"]
    rows = [
        [
            str(e.get("seq", "")),
            e.get("date", ""),
            e.get("description", ""),
            e.get("bill_number", ""),
            _fmt_money(e.get("debit", 0)) if e.get("debit") else "",
            _fmt_money(e.get("credit", 0)) if e.get("credit") else "",
            _fmt_money(e.get("balance", 0)),
        ]
        for e in entries
    ]
    table_data = [headers] + rows
    table = Table(table_data, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1565c0")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, -1), FONT_REGULAR),
                ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("ALIGN", (4, 1), (-1, -1), "RIGHT"),
            ]
        )
    )
    story.append(table)
    if footer:
        story.append(Spacer(1, 12))
        story.append(Paragraph(footer, ParagraphStyle(name="Footer", fontName=FONT_REGULAR, fontSize=8)))
    doc.build(story)
    buffer.seek(0)
    return buffer

