import type { PaymentPrintData } from "@/types/payment";
import { formatCurrency, formatPrintDate } from "@/utils/format";

interface Props {
  data: PaymentPrintData;
}

export default function PaymentPrintLayout({ data }: Props) {
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
                  {data.business_phone && <p className="meta">Phone: {data.business_phone}</p>}
                </div>
                <div className="inv-header-col inv-header-center">
                  <h1 className="invoice-title">PAYMENT RECEIPT</h1>
                </div>
                <div className="inv-header-col inv-header-right">
                  <div className="cust-grid">
                    <span className="lbl">Received from</span>
                    <span className="val">{data.customer_name}</span>
                    <span className="lbl">Account</span>
                    <span className="val">{data.customer_code}</span>
                  </div>
                  <div className="inv-meta-row">
                    <span>
                      <strong>Receipt No.:</strong> {data.receipt_number}
                    </span>
                    <span>
                      <strong>Date:</strong> {formatPrintDate(data.payment_date)}
                    </span>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="inv-body-cell">
              <div className="inv-summary-block">
                <div className="inv-summary-left">
                  <p>
                    <strong>Payment mode:</strong> {data.mode_label}
                  </p>
                  {data.bill_number && (
                    <p>
                      <strong>Against bill:</strong> {data.bill_number}
                    </p>
                  )}
                  {data.reference && (
                    <p>
                      <strong>Reference:</strong> {data.reference}
                    </p>
                  )}
                  {data.notes && (
                    <p>
                      <strong>Notes:</strong> {data.notes}
                    </p>
                  )}
                </div>
                <div className="inv-summary-right">
                  <div className="inv-total-row inv-total-row--primary">
                    <span>Amount received</span>
                    <strong>{formatCurrency(data.amount)}</strong>
                  </div>
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
