import type { ReturnPrintData } from "@/types/return";
import { formatCurrency, formatPrintDate } from "@/utils/format";

interface Props {
  data: ReturnPrintData;
}

export default function ReturnPrintLayout({ data }: Props) {
  const showBillColumn = !!data.multi_bill || data.items.some((row) => row.source_bill_number);
  return (
    <div className="return-print-root invoice-print-root">
      <table className="invoice-shell">
        <thead>
          <tr>
            <td>
              <div className="inv-header">
                <div className="inv-header-col inv-header-left">
                  <p className="shop-name">{data.business_name}</p>
                  {data.business_address && <p className="meta">{data.business_address}</p>}
                  <p className="meta meta-inline">
                    {[data.business_phone && `Phone: ${data.business_phone}`, data.business_gst && `GST: ${data.business_gst}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="inv-header-col inv-header-center">
                  <h1 className="invoice-title">SALES RETURN</h1>
                  {data.is_cancelled && <p className="meta" style={{ color: "#c62828" }}>CANCELLED</p>}
                </div>
                <div className="inv-header-col inv-header-right">
                  <div className="cust-grid">
                    <span className="lbl">Customer</span>
                    <span className="val">{data.customer_name}</span>
                    <span className="lbl">Account</span>
                    <span className="val">{data.customer_code}</span>
                    <span className="lbl">Return No.</span>
                    <span className="val">{data.return_number}</span>
                    <span className="lbl">Date</span>
                    <span className="val">{formatPrintDate(data.return_date)}</span>
                    <span className="lbl">Original Invoice</span>
                    <span className="val">{data.original_invoice_number}</span>
                  </div>
                </div>
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
                    <th className="c-name">PRODUCT</th>
                    {showBillColumn && <th className="c-name">INVOICE</th>}
                    <th className="c-qty">QTY</th>
                    <th className="c-num">RATE</th>
                    <th className="c-num">AMOUNT</th>
                    <th className="c-name">REASON</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row, i) => (
                    <tr key={i}>
                      <td className="c-sn">{i + 1}</td>
                      <td className="c-name">{row.product_name}</td>
                      {showBillColumn && <td className="c-name">{row.source_bill_number || "—"}</td>}
                      <td className="c-qty">{row.quantity}</td>
                      <td className="c-num">{formatCurrency(row.rate)}</td>
                      <td className="c-num">{formatCurrency(row.amount)}</td>
                      <td className="c-name">{row.reason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="inv-summary-block">
                <div className="inv-summary-left">
                  <p>
                    <strong>Return type:</strong> {data.return_type_label}
                  </p>
                  <p>
                    <strong>Settlement:</strong> {data.refund_detail}
                  </p>
                  {data.exchange_bill_number && (
                    <p>
                      <strong>Exchange bill:</strong> {data.exchange_bill_number}
                    </p>
                  )}
                  {data.notes && (
                    <p>
                      <strong>Notes:</strong> {data.notes}
                    </p>
                  )}
                  {data.created_by && (
                    <p>
                      <strong>Processed by:</strong> {data.created_by}
                    </p>
                  )}
                </div>
                <div className="inv-summary-right">
                  <div className="inv-total-row inv-total-row--primary">
                    <span>Return Total</span>
                    <strong>{formatCurrency(data.total)}</strong>
                  </div>
                  {Number(data.refund_paid) > 0 && (
                    <div className="inv-total-row">
                      <span>Refund Paid</span>
                      <strong>{formatCurrency(data.refund_paid)}</strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="return-signature-row">
                <div className="return-signature-box">
                  <span>Customer Signature</span>
                </div>
                <div className="return-signature-box">
                  <span>Authorised Signature</span>
                </div>
              </div>

              {data.footer && <p className="inv-footer-note">{data.footer}</p>}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
