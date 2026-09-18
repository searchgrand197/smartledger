import type { InvoicePrintData } from "@/types/invoice";

interface Props {
  data: InvoicePrintData;
}

function rs(value: string) {
  return `Rs ${value}`;
}

export default function InvoicePrintLayout({ data }: Props) {
  const { shop, customer, items, summary } = data;
  const showBatchExp = items.some((r) => r.batch !== "—" || r.exp !== "—");
  const showBank = Boolean(shop.bank_details && shop.bank_details !== "—");

  const rootClass = ["invoice-print-root", !showBatchExp ? "no-batch-exp" : "", !showBank ? "no-bank" : ""]
    .filter(Boolean)
    .join(" ");

  const discountLabel = summary.discount_percent
    ? `ADD. DIS (${summary.discount_percent}%)`
    : summary.discount
      ? "DISCOUNT"
      : null;

  const summaryLeftSpan = showBatchExp ? 4 : 2;

  return (
    <div className={rootClass}>
      <table className="invoice-shell">
        <thead>
          <tr>
            <td>
              <div className="inv-header">
                <div className="inv-header-col inv-header-left">
                  <p className="shop-name">{shop.name}</p>
                  {shop.address && <p className="meta">{shop.address}</p>}
                  <p className="meta meta-inline">
                    {[shop.phone && `Phone: ${shop.phone}`, shop.email && `E-Mail: ${shop.email}`, shop.gst && `GST: ${shop.gst}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="inv-header-col inv-header-center">
                  <h1 className="invoice-title">ESTIMATE BILL</h1>
                </div>
                <div className="inv-header-col inv-header-right">
                  <div className="cust-grid">
                    <span className="lbl">Customer Name</span>
                    <span className="val">{customer.name || "Walk-in"}</span>
                    <span className="lbl">Customer Phone</span>
                    <span className="val">{customer.phone || "—"}</span>
                    <span className="lbl">Customer Address</span>
                    <span className="val">{customer.address || "—"}</span>
                  </div>
                </div>
              </div>
              <div className="inv-meta-row inv-meta-row--full">
                <span>
                  <strong>Invoice No. :</strong> {data.bill_number}
                </span>
                <span>
                  <strong>Date:</strong> {data.date}
                </span>
              </div>
            </td>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td className="inv-body-cell">
              <table className="inv-items">
                <thead>
                  <tr>
                    <th className="c-sn">SN</th>
                    <th className="c-name">PRODUCT NAME</th>
                    {showBatchExp && (
                      <>
                        <th className="c-batch">BATCH</th>
                        <th className="c-exp">EXP.</th>
                      </>
                    )}
                    <th className="c-qty">QTY</th>
                    <th className="c-num">RATE</th>
                    <th className="c-num">AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.sn}>
                      <td className="c-sn">{row.sn}</td>
                      <td className="c-name">{row.name}</td>
                      {showBatchExp && (
                        <>
                          <td className="c-batch">{row.batch}</td>
                          <td className="c-exp">{row.exp}</td>
                        </>
                      )}
                      <td className="c-qty">{row.qty}</td>
                      <td className="c-num">{rs(row.rate)}</td>
                      <td className="c-num">{rs(row.amount)}</td>
                    </tr>
                  ))}
                  <tr className="inv-table-summary">
                    <td colSpan={summaryLeftSpan} className="summary-left">
                      <span>Subtotal {rs(summary.subtotal)}</span>
                      <span className="summary-note">Non-GST bill (no tax)</span>
                    </td>
                    <td colSpan={2} className="summary-qty">
                      Total Qty {summary.total_qty}
                    </td>
                    <td className="c-num">&nbsp;</td>
                  </tr>
                </tbody>
              </table>

              <div className="inv-footer">
                <div className="inv-footer-col inv-footer-terms">
                  <p className="footer-heading">Terms &amp; Conditions</p>
                  <ul className="terms-list">
                    {data.terms.map((line) => {
                      const cleaned = line.replace(/^[\s•\-*\u2022]+/, "").trim();
                      const numbered = /^\d+[\.\)]\s*/.test(cleaned);
                      return (
                        <li key={line} className={numbered ? "terms-numbered" : undefined}>
                          {cleaned}
                        </li>
                      );
                    })}
                  </ul>
                  {data.remark && (
                    <p className="remark-line">
                      Remark: <span className="remark-val">{data.remark}</span>
                    </p>
                  )}
                  <p className="pay-line">
                    Payment: <strong>{data.payment_mode}</strong>
                  </p>
                  <p className="amount-words">Rupees (in words): {data.amount_in_words}</p>
                </div>

                {showBank && (
                  <div className="inv-footer-col inv-footer-bank">
                    <p className="footer-heading">BANK DETAILS :-</p>
                    <p className="bank-text">{shop.bank_details}</p>
                  </div>
                )}

                <div className="inv-footer-col inv-footer-sign">
                  <p className="for-shop">For {shop.name}</p>
                  <div className="sign-space" />
                  <p className="sign-label">Authorised Signatory</p>
                </div>

                <div className="inv-footer-col inv-footer-totals">
                  <div className="total-row">
                    <span>SUB TOTAL</span>
                    <span>{rs(summary.subtotal)}</span>
                  </div>
                  {discountLabel && summary.discount && (
                    <div className="total-row">
                      <span>{discountLabel}</span>
                      <span>{rs(summary.discount)}</span>
                    </div>
                  )}
                  {summary.round_off && (
                    <div className="total-row">
                      <span>ROUND OFF</span>
                      <span>{rs(summary.round_off)}</span>
                    </div>
                  )}
                  <div className="total-row">
                    <span>PAID</span>
                    <span>{rs(summary.paid)}</span>
                  </div>
                  <div className="total-row">
                    <span>DUE</span>
                    <span>{rs(summary.due)}</span>
                  </div>
                  {summary.show_party_balances && summary.previous_balance && (
                    <div className="total-row">
                      <span>PREV. BALANCE</span>
                      <span>{rs(summary.previous_balance)}</span>
                    </div>
                  )}
                  <div className="total-row grand-total">
                    <span>GRAND TOTAL</span>
                    <span>{rs(summary.grand_total)}</span>
                  </div>
                  {summary.show_party_balances && summary.closing_balance && (
                    <div className="total-row closing-total">
                      <span>CLOSING BALANCE</span>
                      <span>{rs(summary.closing_balance)}</span>
                    </div>
                  )}
                  <p className="generated-note">Computer Generated Invoice</p>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
