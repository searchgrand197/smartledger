"""Sales return PDF — matches on-screen / print return receipt layout."""

from decimal import Decimal
from datetime import datetime
from io import BytesIO

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from core.fonts import FONT_BOLD, FONT_REGULAR
from core.invoice_pdf import _BORDER, _INNER_GRID, _PAGE_MARGIN, _PAD_ITEM, _esc, _fmt, _p, _table_style
from returns.print_data import build_return_print_data


def _print_date(iso_value: str) -> str:
    if not iso_value:
        return "—"
    try:
        raw = iso_value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(raw)
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt, timezone.get_current_timezone())
        return timezone.localtime(dt).strftime("%d-%m-%y")
    except (ValueError, TypeError):
        return iso_value[:10] if len(iso_value) >= 10 else iso_value


def build_return_pdf(sales_return) -> BytesIO:
    data = build_return_print_data(sales_return)
    show_invoice_col = bool(data.get("multi_bill")) or any(
        row.get("source_bill_number") for row in data.get("items", [])
    )

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=_PAGE_MARGIN,
        leftMargin=_PAGE_MARGIN,
        topMargin=_PAGE_MARGIN,
        bottomMargin=_PAGE_MARGIN,
    )
    cw = doc.width

    label_style = ParagraphStyle("RetLabel", fontName=FONT_BOLD, fontSize=7.5, leading=10, alignment=TA_LEFT)
    value_style = ParagraphStyle("RetValue", fontName=FONT_REGULAR, fontSize=7.5, leading=10, alignment=TA_LEFT, wordWrap="LTR")
    bold = ParagraphStyle("RetBold", fontName=FONT_BOLD, fontSize=7.5, leading=10)
    right_bold = ParagraphStyle("RetRightBold", parent=bold, alignment=TA_RIGHT)
    small = ParagraphStyle("RetSmall", fontName=FONT_REGULAR, fontSize=7, leading=10, wordWrap="LTR")
    cell_center = ParagraphStyle("RetCellC", fontName=FONT_REGULAR, fontSize=7, leading=9.5, alignment=TA_CENTER)
    cell_desc = ParagraphStyle("RetCellDesc", fontName=FONT_REGULAR, fontSize=7, leading=9.5, alignment=TA_LEFT, wordWrap="LTR")
    cell_right = ParagraphStyle("RetCellR", fontName=FONT_REGULAR, fontSize=7, leading=9.5, alignment=TA_RIGHT)
    header_cell = ParagraphStyle(
        "RetHdr",
        fontName=FONT_BOLD,
        fontSize=7.5,
        leading=9.5,
        alignment=TA_CENTER,
        textColor=colors.white,
        wordWrap="LTR",
    )
    header_desc = ParagraphStyle(
        "RetHdrDesc",
        fontName=FONT_BOLD,
        fontSize=7.5,
        leading=9.5,
        alignment=TA_LEFT,
        textColor=colors.white,
        wordWrap="LTR",
    )

    story = []

    # Header — shop | SALES RETURN | customer meta
    shop_title = f"<b><font size=10.5>{_esc(data['business_name'])}</font></b>"
    shop_lines = []
    if data.get("business_address"):
        shop_lines.append(_esc(data["business_address"].strip()))
    meta_parts = []
    if data.get("business_phone"):
        meta_parts.append(f"Phone: {data['business_phone']}")
    if data.get("business_gst"):
        meta_parts.append(f"GST: {data['business_gst']}")
    if meta_parts:
        shop_lines.append(" · ".join(meta_parts))
    left_text = shop_title + ("<br/>" + "<br/>".join(f"<font size=7.5 color='#333333'>{p}</font>" for p in shop_lines) if shop_lines else "")
    left_paragraph = _p(left_text, value_style)

    title = "SALES RETURN"
    if data.get("is_cancelled"):
        title += "<br/><font color='#c62828' size=7>CANCELLED</font>"
    center_paragraph = _p(f"<b>{title}</b>", ParagraphStyle("RetTitle", parent=bold, fontSize=13, leading=16, alignment=TA_CENTER))

    cust_rows = [
        [_p("<b>Customer</b>", label_style), _p(data["customer_name"], value_style, user_content=True)],
        [_p("<b>Account</b>", label_style), _p(data["customer_code"], value_style, user_content=True)],
        [_p("<b>Return No.</b>", label_style), _p(data["return_number"], value_style, user_content=True)],
        [_p("<b>Date</b>", label_style), _p(_print_date(data["return_date"]), value_style)],
        [_p("<b>Original Invoice</b>", label_style), _p(data["original_invoice_number"], value_style, user_content=True)],
    ]
    cust_table = Table(cust_rows, colWidths=[cw * 0.14, cw * 0.24])
    cust_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 1.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
            ]
        )
    )

    header_table = Table([[left_paragraph, center_paragraph, cust_table]], colWidths=[cw * 0.38, cw * 0.24, cw * 0.38])
    header_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), _BORDER, colors.black),
                ("INNERGRID", (0, 0), (-1, -1), _INNER_GRID, colors.black),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (0, 0), 6),
                ("RIGHTPADDING", (0, 0), (0, 0), 6),
                ("TOPPADDING", (0, 0), (0, 0), 6),
                ("BOTTOMPADDING", (0, 0), (0, 0), 6),
                ("LEFTPADDING", (1, 0), (1, 0), 4),
                ("RIGHTPADDING", (1, 0), (1, 0), 4),
                ("TOPPADDING", (1, 0), (1, 0), 6),
                ("BOTTOMPADDING", (1, 0), (1, 0), 6),
                ("VALIGN", (1, 0), (1, 0), "MIDDLE"),
                ("LEFTPADDING", (2, 0), (2, 0), 6),
                ("RIGHTPADDING", (2, 0), (2, 0), 6),
                ("TOPPADDING", (2, 0), (2, 0), 6),
                ("BOTTOMPADDING", (2, 0), (2, 0), 6),
            ]
        )
    )
    story.append(header_table)
    story.append(Spacer(1, 4))

    # Items table
    item_header = [
        _p("SN", header_cell),
        _p("PRODUCT", header_desc),
    ]
    if show_invoice_col:
        item_header.append(_p("INVOICE", header_desc))
    item_header.extend(
        [
            _p("QTY", header_cell),
            _p("RATE", header_cell),
            _p("AMOUNT", header_cell),
            _p("REASON", header_desc),
        ]
    )

    item_rows = [item_header]
    for idx, row in enumerate(data.get("items") or [], start=1):
        line = [
            _p(str(idx), cell_center),
            _p(row["product_name"], cell_desc, user_content=True),
        ]
        if show_invoice_col:
            line.append(_p(row.get("source_bill_number") or "—", cell_desc, user_content=True))
        line.extend(
            [
                _p(str(row["quantity"]), cell_center),
                _p(f"Rs {_fmt(row['rate'])}", cell_right),
                _p(f"Rs {_fmt(row['amount'])}", cell_right),
                _p(row.get("reason") or "—", cell_desc, user_content=True),
            ]
        )
        item_rows.append(line)

    if show_invoice_col:
        col_widths = [cw * 0.05, cw * 0.28, cw * 0.14, cw * 0.07, cw * 0.12, cw * 0.14, cw * 0.20]
    else:
        col_widths = [cw * 0.05, cw * 0.36, cw * 0.08, cw * 0.14, cw * 0.17, cw * 0.20]

    items_last = len(data.get("items") or [])
    items_table = Table(item_rows, colWidths=col_widths, repeatRows=1)
    items_table.setStyle(
        _table_style(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4a4a4a")),
                ("ALIGN", (0, 1), (0, items_last), "CENTER"),
                ("VALIGN", (0, 0), (-1, items_last), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, 0), _PAD_ITEM + 1),
                ("BOTTOMPADDING", (0, 0), (-1, 0), _PAD_ITEM + 1),
                ("TOPPADDING", (0, 1), (-1, items_last), _PAD_ITEM),
                ("BOTTOMPADDING", (0, 1), (-1, items_last), _PAD_ITEM),
            ]
        )
    )
    story.append(items_table)

    # Summary block
    summary_left_lines = [
        f"<b>Return type:</b> {_esc(data.get('return_type_label') or '')}",
        f"<b>Settlement:</b> {_esc(data.get('refund_detail') or '')}",
    ]
    if data.get("exchange_bill_number"):
        summary_left_lines.append(f"<b>Exchange bill:</b> {_esc(data['exchange_bill_number'])}")
    if data.get("notes"):
        summary_left_lines.append(f"<b>Notes:</b> {_esc(data['notes'])}")
    if data.get("created_by"):
        summary_left_lines.append(f"<b>Processed by:</b> {_esc(data['created_by'])}")
    summary_left = _p("<br/>".join(summary_left_lines), small)

    total_rows = [[_p("<b>Return Total</b>", label_style), _p(f"Rs {_fmt(data['total'])}", right_bold)]]
    if Decimal(str(data.get("refund_paid") or 0)) > 0:
        total_rows.append([_p("Refund Paid", label_style), _p(f"Rs {_fmt(data['refund_paid'])}", right_bold)])
    totals_table = Table(total_rows, colWidths=[cw * 0.14, cw * 0.12])
    totals_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), _BORDER, colors.black),
                ("INNERGRID", (0, 0), (-1, -1), _INNER_GRID, colors.black),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#ecfdf5")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )

    summary_table = Table([[summary_left, totals_table]], colWidths=[cw * 0.68, cw * 0.32])
    summary_table.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), _BORDER, colors.black),
                ("LINEAFTER", (0, 0), (0, 0), _BORDER, colors.black),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (0, 0), 8),
                ("RIGHTPADDING", (0, 0), (0, 0), 8),
                ("TOPPADDING", (0, 0), (0, 0), 8),
                ("BOTTOMPADDING", (0, 0), (0, 0), 8),
                ("LEFTPADDING", (1, 0), (1, 0), 8),
                ("RIGHTPADDING", (1, 0), (1, 0), 8),
                ("TOPPADDING", (1, 0), (1, 0), 8),
                ("BOTTOMPADDING", (1, 0), (1, 0), 8),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
            ]
        )
    )
    story.append(Spacer(1, 4))
    story.append(summary_table)

    # Signatures — line above label, then signing space (matches ReturnPrintLayout)
    def _signature_cell(label: str):
        cell_table = Table(
            [[_p(label, small)], [_p("&#160;", small)]],
            colWidths=[cw * 0.46],
            rowHeights=[12, 42],
        )
        cell_table.setStyle(
            TableStyle(
                [
                    ("LINEABOVE", (0, 0), (0, 0), _BORDER, colors.HexColor("#333333")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (0, 0), 6),
                    ("BOTTOMPADDING", (0, 0), (0, 0), 2),
                    ("TOPPADDING", (0, 1), (0, 1), 0),
                    ("LEFTPADDING", (0, 0), (-1, -1), 2),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                ]
            )
        )
        return cell_table

    sig_table = Table(
        [[_signature_cell("Customer Signature"), _signature_cell("Authorised Signature")]],
        colWidths=[cw * 0.5, cw * 0.5],
    )
    sig_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (0, 0), 0),
                ("RIGHTPADDING", (1, 0), (1, 0), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.append(sig_table)

    if data.get("footer"):
        story.append(Spacer(1, 8))
        story.append(
            _p(
                data["footer"],
                ParagraphStyle("RetFooter", parent=small, alignment=TA_CENTER, fontSize=6.5, textColor=colors.HexColor("#444444")),
                user_content=True,
            )
        )

    doc.build(story)
    buffer.seek(0)
    return buffer
