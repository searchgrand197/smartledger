"""Retail invoice PDF — styled table invoice with party balances."""

from decimal import Decimal
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from core.fonts import FONT_REGULAR, FONT_BOLD
from core.unicode_text import format_terms_lines, terms_flowables, paragraph_or_shaped

from core.amount_words import amount_in_words

_CELL_PAD = 3
_BORDER = 0.4
_INNER_GRID = 0.125
_PAD_HEADER = 4
_PAD_HEADER_SIDE = 5
_PAD_ITEM = 3
_PAD_SUMMARY = 4
_PAD_SUMMARY_SIDE = 5
_PAD_FOOTER = 4
_PAD_FOOTER_SIDE = 5
_PAGE_MARGIN = 6 * mm


def _fmt(value) -> str:
    return f"{Decimal(str(value or 0)):,.2f}"


def _split_rs_paise(value) -> tuple[str, str]:
    d = Decimal(str(value or 0)).quantize(Decimal("0.01"))
    rupees = int(d)
    paise = int((d - rupees) * 100)
    return str(rupees), f"{paise:02d}"


def _esc(text: str) -> str:
    return (
        (text or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _p(text: str, style: ParagraphStyle, *, user_content: bool = False) -> Paragraph:
    """Plain text paragraph — no raw HTML tags (bold comes from style only)."""
    raw = (text or "").strip() or " "
    if user_content:
        raw = _esc(raw)
    return Paragraph(raw.replace("\n", "<br/>"), style)


def _ensure_invoice_number(bill) -> str:
    if bill.bill_number:
        return bill.bill_number
    bill.save()
    bill.refresh_from_db()
    return bill.bill_number


def _buyer_from_bill(bill) -> dict:
    from billing.walkin import simple_bill_walk_in_name

    c = bill.customer
    if c.code == "CUS-WALK":
        return {
            "name": simple_bill_walk_in_name(bill.notes or ""),
            "address": "",
            "phone": "",
            "whatsapp": "",
            "aadhar": "",
            "pan": "",
        }
    return {
        "name": c.shop_name or "",
        "address": (c.address or c.area or "").strip(),
        "phone": c.phone or "",
        "whatsapp": c.phone or "",
        "aadhar": "",
        "pan": "",
    }


def _table_style(extra=None) -> TableStyle:
    base = [
        ("BOX", (0, 0), (-1, -1), _BORDER, colors.black),
        ("INNERGRID", (0, 0), (-1, -1), _INNER_GRID, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), _CELL_PAD),
        ("RIGHTPADDING", (0, 0), (-1, -1), _CELL_PAD),
        ("TOPPADDING", (0, 0), (-1, -1), _CELL_PAD),
        ("BOTTOMPADDING", (0, 0), (-1, -1), _CELL_PAD),
    ]
    if extra:
        base.extend(extra)
    return TableStyle(base)


def build_invoice_pdf(bill, settings=None, balance_info: dict | None = None) -> BytesIO:
    from business.models import BusinessSettings

    settings = settings or BusinessSettings.load()
    invoice_no = _ensure_invoice_number(bill)
    buyer = _buyer_from_bill(bill)
    items = list(bill.items.select_related("product").all())

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

    label_style = ParagraphStyle(
        "Label",
        fontName=FONT_BOLD,
        fontSize=7.5,
        leading=10,
        alignment=TA_LEFT,
    )
    value_style = ParagraphStyle(
        "Value",
        fontName=FONT_REGULAR,
        fontSize=7.5,
        leading=10,
        alignment=TA_LEFT,
        wordWrap="LTR",
    )
    normal = ParagraphStyle("InvNormal", fontName=FONT_REGULAR, fontSize=7.5, leading=10, wordWrap="LTR")
    bold = ParagraphStyle("InvBold", fontName=FONT_BOLD, fontSize=7.5, leading=10)
    right = ParagraphStyle("InvRight", parent=bold, alignment=TA_RIGHT)
    right_normal = ParagraphStyle("InvRightNormal", parent=normal, alignment=TA_RIGHT)
    small = ParagraphStyle("InvSmall", fontName=FONT_REGULAR, fontSize=7, leading=10, wordWrap="LTR")
    cell_center = ParagraphStyle("CellC", fontName=FONT_REGULAR, fontSize=7, leading=9.5, alignment=TA_CENTER)
    cell_desc = ParagraphStyle("CellDesc", fontName=FONT_REGULAR, fontSize=7, leading=9.5, alignment=TA_LEFT, wordWrap="LTR")
    cell_right = ParagraphStyle("CellR", fontName=FONT_REGULAR, fontSize=7, leading=9.5, alignment=TA_RIGHT)

    story = []

    # 1. HEADER SECTION
    shop_title = f"<b><font size=10.5>{_esc(settings.business_name or 'YOUR STORE')}</font></b>"
    shop_details = []
    if settings.address:
        shop_details.append(_esc(settings.address.strip()))
    meta_parts = []
    if settings.phone:
        meta_parts.append(f"Phone: {settings.phone}")
    if settings.email:
        meta_parts.append(f"E-Mail: {settings.email}")
    if settings.gst_number:
        meta_parts.append(f"GST: {settings.gst_number}")
    if meta_parts:
        shop_details.append(" · ".join(meta_parts))
    
    left_text = f"{shop_title}<br/>" + "<br/>".join(f"<font size=7.5 color='#333333'>{part}</font>" for part in shop_details)
    left_paragraph = _p(left_text, value_style)

    center_paragraph = _p("<b>ESTIMATE<br/>BILL</b>", ParagraphStyle("H2", parent=bold, fontSize=14, leading=17, alignment=TA_CENTER))

    cust_table_data = [
        [_p("<b>Customer Name</b>", value_style), _p(buyer["name"] or "Walk-in", value_style, user_content=True)],
        [_p("<b>Customer Phone</b>", value_style), _p(buyer["phone"] or "—", value_style, user_content=True)],
        [_p("<b>Customer Address</b>", value_style), _p(buyer["address"] or "—", value_style, user_content=True)],
    ]
    cust_table = Table(cust_table_data, colWidths=[cw * 0.13, cw * 0.25])
    cust_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
    ]))

    inv_date = bill.created_at.strftime("%d-%m-%y %H:%M")
    meta_inner = Table(
        [
            [
                _p(f"<b>Invoice No. :</b> {invoice_no}", value_style),
                _p(f"<b>Date:</b> {inv_date}", ParagraphStyle("MetaRight", parent=value_style, alignment=TA_RIGHT))
            ]
        ],
        colWidths=[cw * 0.5, cw * 0.5]
    )
    meta_inner.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (0, 0), 6),
        ("RIGHTPADDING", (1, 0), (1, 0), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))

    header_data = [
        [
            left_paragraph,
            center_paragraph,
            cust_table
        ],
        [
            meta_inner,
            "",
            ""
        ]
    ]
    header_table = Table(header_data, colWidths=[cw * 0.38, cw * 0.24, cw * 0.38])
    header_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), _BORDER, colors.black),
        ("INNERGRID", (0, 0), (-1, 0), _INNER_GRID, colors.black),
        ("SPAN", (0, 1), (2, 1)),
        ("LINEABOVE", (0, 1), (2, 1), _BORDER, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
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
    ]))
    story.append(header_table)
    story.append(Spacer(1, 4))

    # 2. ITEMS TABLE SECTION
    header_cell = ParagraphStyle(
        "HdrCell",
        fontName=FONT_BOLD,
        fontSize=7.5,
        leading=9.5,
        alignment=TA_CENTER,
        textColor=colors.white,
        wordWrap="LTR",
    )
    header_desc = ParagraphStyle(
        "HdrDesc",
        fontName=FONT_BOLD,
        fontSize=7.5,
        leading=9.5,
        alignment=TA_LEFT,
        textColor=colors.white,
        wordWrap="LTR",
    )
    item_header = [
        _p("SN", header_cell),
        _p("PRODUCT NAME", header_desc),
        _p("QTY", header_cell),
        _p("RATE", header_cell),
        _p("AMOUNT", header_cell),
    ]
    item_rows = [item_header]
    for idx, line in enumerate(items, start=1):
        item_rows.append(
            [
                _p(str(idx), cell_center),
                _p(line.product.name, cell_desc, user_content=True),
                _p(str(line.quantity), cell_center),
                _p(_fmt(line.rate), cell_right),
                _p(_fmt(line.amount), cell_right),
            ]
        )

    subtotal = bill.subtotal
    discount = bill.discount_amount or Decimal("0")
    grand = bill.total
    paid = bill.paid_amount or Decimal("0")
    due = grand - paid
    total_qty = sum(int(i.quantity or 0) for i in items)
    words = amount_in_words(grand)

    summary_left_text = f"<b>Subtotal Rs {_fmt(subtotal)}</b>   <font size=7 color='#666666'>Non-GST bill (no tax)</font>"
    summary_qty_text = f"<b>Total Qty {total_qty}</b>"
    
    item_rows.append([
        _p(summary_left_text, value_style), "",
        _p(summary_qty_text, right), "",
        ""
    ])

    col_widths = [
        cw * 0.05,   # SN
        cw * 0.52,   # Product
        cw * 0.09,   # Qty
        cw * 0.14,   # Rate
        cw * 0.20,   # Amount
    ]

    items_last_row = len(items)
    summary_row_idx = len(items) + 1

    table_styles = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4a4a4a")),
        ("ALIGN", (0, 0), (0, items_last_row), "CENTER"),
        ("ALIGN", (2, 0), (2, items_last_row), "CENTER"),
        ("ALIGN", (3, 0), (3, items_last_row), "RIGHT"),
        ("ALIGN", (4, 0), (4, items_last_row), "RIGHT"),
        ("VALIGN", (0, 0), (-1, items_last_row), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, 0), _PAD_ITEM + 1),
        ("BOTTOMPADDING", (0, 0), (-1, 0), _PAD_ITEM + 1),
        ("TOPPADDING", (0, 1), (-1, items_last_row), _PAD_ITEM),
        ("BOTTOMPADDING", (0, 1), (-1, items_last_row), _PAD_ITEM),
        ("LEFTPADDING", (1, 0), (1, items_last_row), _PAD_ITEM + 2),
        ("RIGHTPADDING", (4, 0), (4, items_last_row), _PAD_ITEM + 2),
        ("LEFTPADDING", (0, 0), (0, items_last_row), _CELL_PAD),
        ("RIGHTPADDING", (2, 0), (4, items_last_row), _CELL_PAD + 1),
        ("SPAN", (0, summary_row_idx), (1, summary_row_idx)),
        ("SPAN", (2, summary_row_idx), (3, summary_row_idx)),
        ("BACKGROUND", (0, summary_row_idx), (-1, summary_row_idx), colors.HexColor("#f0f0f0")),
        ("LINEABOVE", (0, summary_row_idx), (-1, summary_row_idx), _BORDER, colors.black),
        ("LINEBELOW", (0, summary_row_idx), (-1, summary_row_idx), _BORDER, colors.black),
        ("VALIGN", (0, summary_row_idx), (-1, summary_row_idx), "MIDDLE"),
        ("TOPPADDING", (0, summary_row_idx), (-1, summary_row_idx), 4),
        ("BOTTOMPADDING", (0, summary_row_idx), (-1, summary_row_idx), 4),
        ("LEFTPADDING", (0, summary_row_idx), (0, summary_row_idx), 6),
        ("RIGHTPADDING", (2, summary_row_idx), (3, summary_row_idx), 6),
    ]

    items_table = Table(item_rows, colWidths=col_widths, repeatRows=1)
    items_table.setStyle(_table_style(table_styles))
    story.append(items_table)
    story.append(Spacer(1, 4))

    # 3. FOOTER SECTION
    terms_lines = format_terms_lines(
        settings.invoice_footer or "",
        default_lines=["Thank you! Quality plumbing materials at best rates."],
    )

    show_bank = bool(settings.factory_details and settings.factory_details.strip() != "—")
    if show_bank:
        footer_widths = [cw * 0.35, cw * 0.19, cw * 0.21, cw * 0.25]
    else:
        footer_widths = [cw * 0.45, cw * 0.26, cw * 0.29]
    terms_max_w = footer_widths[0] - 8

    terms_heading = ParagraphStyle(
        "InvTermsHead",
        fontName=FONT_BOLD,
        fontSize=7.5,
        leading=10,
        wordWrap="LTR",
    )
    terms_body = ParagraphStyle(
        "InvTermsBody",
        fontName=FONT_REGULAR,
        fontSize=7,
        leading=9.5,
        wordWrap="LTR",
    )

    col1_content = []
    # Prefer Hindi "नोट" block as-is; only add English heading when footer is English
    first = terms_lines[0] if terms_lines else ""
    from core.unicode_text import contains_indic

    if not contains_indic(first):
        col1_content.append(_p("<b>Terms & Conditions</b>", bold))
        col1_content.append(Spacer(1, 2))

    col1_content.extend(
        terms_flowables(
            terms_lines,
            style=terms_body,
            heading_style=terms_heading,
            max_width=terms_max_w,
            make_paragraph=_p,
            gap=2,
        )
    )

    remark = (bill.notes or "").strip()
    if remark and not remark.startswith("Walkin:") and not remark.startswith("Simple customer:"):
        col1_content.append(Spacer(1, 3))
        col1_content.append(
            paragraph_or_shaped(
                f"Remark: {remark}",
                terms_body,
                max_width=terms_max_w,
                user_content=True,
                make_paragraph=_p,
            )
        )

    col1_content.append(Spacer(1, 4))
    col1_content.append(_p(f"Payment: <b>{bill.get_payment_mode_display()}</b>", terms_body))
    col1_content.append(Spacer(1, 2))
    col1_content.append(_p(f"Rupees (in words): {words}", terms_body))

    col2_content = []
    if show_bank:
        col2_content.append(_p("<b>BANK DETAILS :-</b>", bold))
        bank_lines = format_terms_lines(settings.factory_details or "")
        bank_max_w = footer_widths[1] - 8
        for line in bank_lines:
            col2_content.append(
                paragraph_or_shaped(
                    line,
                    terms_body,
                    max_width=bank_max_w,
                    user_content=True,
                    make_paragraph=_p,
                )
            )
            col2_content.append(Spacer(1, 1.5))
        if col2_content and isinstance(col2_content[-1], Spacer):
            col2_content.pop()

    w_col3 = footer_widths[2] if show_bank else footer_widths[1]

    sign_table_data = [
        [_p(f"For {settings.business_name or 'YOUR STORE'}", ParagraphStyle("ForShop", parent=bold, fontSize=7.5, leading=9.5))],
        [Spacer(1, 28)],
        [_p("Authorised Signatory", ParagraphStyle("SignLabel", parent=normal, fontSize=7.5, leading=9, alignment=TA_CENTER))]
    ]
    sign_table = Table(sign_table_data, colWidths=[w_col3 - 12])
    sign_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("ALIGN", (0, 2), (0, 2), "CENTER"),
        ("LINEABOVE", (0, 2), (0, 2), 0.5, colors.black),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ]))
    col3_content = [sign_table]

    w_col4 = footer_widths[-1]
    totals_rows = []
    totals_rows.append([_p("SUB TOTAL", label_style), _p(f"Rs {_fmt(subtotal)}", right)])
    
    if discount:
        disc_label = f"ADD. DIS ({bill.discount_percent}%)" if bill.discount_percent else "DISCOUNT"
        totals_rows.append([_p(disc_label, label_style), _p(f"-Rs {_fmt(discount)}", right)])
        
    if bill.round_off:
        totals_rows.append([_p("ROUND OFF", label_style), _p(f"Rs {_fmt(bill.round_off)}", right)])
        
    totals_rows.append([_p("PAID", label_style), _p(f"Rs {_fmt(paid)}", right)])
    totals_rows.append([_p("DUE", label_style), _p(f"Rs {_fmt(due)}", right)])
    
    show_party_balances = bool(balance_info and bill.customer.code != "CUS-WALK")
    if show_party_balances:
        closing_val = Decimal(str(balance_info.get("total_balance", 0)))
        prev_val = closing_val - due
        totals_rows.append([_p("PREV. BALANCE", label_style), _p(f"Rs {_fmt(prev_val)}", right_normal)])
        
    grand_label_style = ParagraphStyle("GrandLabel", parent=bold, textColor=colors.white)
    grand_val_style = ParagraphStyle("GrandValue", parent=right, textColor=colors.white)
    totals_rows.append([_p("GRAND TOTAL", grand_label_style), _p(f"Rs {_fmt(grand)}", grand_val_style)])
    
    if show_party_balances:
        totals_rows.append([_p("CLOSING BALANCE", grand_label_style), _p(f"Rs {_fmt(closing_val)}", grand_val_style)])
        
    totals_table = Table(totals_rows, colWidths=[w_col4 * 0.58, w_col4 * 0.42])
    
    t_styles = [
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, colors.HexColor("#e0e0e0")),
    ]
    
    grand_total_idx = None
    closing_balance_idx = None
    for r_idx, row in enumerate(totals_rows):
        label_text = row[0].text
        if "GRAND TOTAL" in label_text:
            grand_total_idx = r_idx
        elif "CLOSING BALANCE" in label_text:
            closing_balance_idx = r_idx
            
    if grand_total_idx is not None:
        t_styles.extend([
            ("BACKGROUND", (0, grand_total_idx), (-1, grand_total_idx), colors.HexColor("#111111")),
            ("TOPPADDING", (0, grand_total_idx), (-1, grand_total_idx), 4.5),
            ("BOTTOMPADDING", (0, grand_total_idx), (-1, grand_total_idx), 4.5),
        ])
    if closing_balance_idx is not None:
        t_styles.extend([
            ("BACKGROUND", (0, closing_balance_idx), (-1, closing_balance_idx), colors.HexColor("#111111")),
            ("TOPPADDING", (0, closing_balance_idx), (-1, closing_balance_idx), 4.5),
            ("BOTTOMPADDING", (0, closing_balance_idx), (-1, closing_balance_idx), 4.5),
        ])
        if grand_total_idx is not None:
            t_styles.append(("LINEBELOW", (0, grand_total_idx), (-1, grand_total_idx), 0.5, colors.HexColor("#ffffff")))
            
    totals_table.setStyle(TableStyle(t_styles))
    
    col4_content = [
        totals_table,
        Spacer(1, 4),
        _p("Computer Generated Invoice", ParagraphStyle("GenNote", parent=small, alignment=TA_RIGHT, fontSize=6, textColor=colors.HexColor("#555555")))
    ]

    footer_row_cells = [col1_content]
    if show_bank:
        footer_row_cells.append(col2_content)
    footer_row_cells.append(col3_content)
    footer_row_cells.append(col4_content)
    
    footer_table = Table([footer_row_cells], colWidths=footer_widths)
    footer_styles = [
        ("BOX", (0, 0), (-1, -1), _BORDER, colors.black),
        ("INNERGRID", (0, 0), (-1, -1), _BORDER, colors.black),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING", (0, 0), (0, 0), 6),
        ("RIGHTPADDING", (0, 0), (0, 0), 6),
        ("TOPPADDING", (0, 0), (0, 0), 6),
        ("BOTTOMPADDING", (0, 0), (0, 0), 6),
    ]
    if show_bank:
        footer_styles.extend([
            ("LEFTPADDING", (1, 0), (2, 0), 6),
            ("RIGHTPADDING", (1, 0), (2, 0), 6),
            ("TOPPADDING", (1, 0), (2, 0), 6),
            ("BOTTOMPADDING", (1, 0), (2, 0), 6),
        ])
    else:
        footer_styles.extend([
            ("LEFTPADDING", (1, 0), (1, 0), 6),
            ("RIGHTPADDING", (1, 0), (1, 0), 6),
            ("TOPPADDING", (1, 0), (1, 0), 6),
            ("BOTTOMPADDING", (1, 0), (1, 0), 6),
        ])
    footer_table.setStyle(TableStyle(footer_styles))
    story.append(footer_table)

    doc.build(story)
    buffer.seek(0)
    return buffer
