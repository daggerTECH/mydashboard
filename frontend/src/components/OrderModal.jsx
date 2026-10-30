import { useEffect, useState } from 'react';
import { API } from '../lib/api.js';
import { useDashboard } from '../context/DashboardContext.jsx';
import { fmtMoney, titleCase } from '../lib/format.js';
import { ErrorState } from './States.jsx';

export default function OrderModal({ orderId, onClose }) {
  const { range, currency } = useDashboard();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setOrder(null); setError(null);
    API.orderDetail(orderId, range).then((res) => {
      if (cancelled) return;
      if (res.ok) setOrder(res.data); else setError(res.error);
    });
    return () => { cancelled = true; };
  }, [orderId, range]);

  return (
    <div className="modal-overlay is-open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal__header">
          <h4 style={{ fontSize: 15 }}>Order #{orderId}</h4>
          <span className="modal__close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </span>
        </div>
        <div className="modal__body">
          {error && <ErrorState error={error} heading="Could not load order details" />}
          {!error && !order && <div className="skeleton" style={{ height: 120 }} />}
          {order && (
            <>
              <div className="modal__section">
                <h4>Billing</h4>
                <div className="kv-grid">
                  <div className="k">Customer</div><div className="v">{order.customer.name}</div>
                  <div className="k">Email</div><div className="v">{order.customer.email}</div>
                  <div className="k">Payment method</div><div className="v">{order.payment_method}</div>
                  <div className="k">Status</div><div className="v"><span className={`status-badge status-${order.status}`}>{titleCase(order.status)}</span></div>
                </div>
              </div>
              <div className="modal__section">
                <h4>Items purchased</h4>
                {order.items.map((i, idx) => (
                  <div className="line-item" key={idx}>
                    <span>{i.name} <span className="text-muted">x{i.qty}</span></span>
                    <span className="cell-mono">{fmtMoney(i.total, currency)}</span>
                  </div>
                ))}
              </div>
              <div className="modal__section">
                <div className="totals-row"><span>Subtotal</span><span>{fmtMoney(order.subtotal, currency)}</span></div>
                <div className="totals-row"><span>Discount</span><span>{order.discount ? '-' + fmtMoney(order.discount, currency) : '—'}</span></div>
                <div className="totals-row"><span>Shipping</span><span>{fmtMoney(order.shipping, currency)}</span></div>
                <div className="totals-row"><span>Tax</span><span>{fmtMoney(order.tax, currency)}</span></div>
                <div className="totals-row is-grand"><span>Total</span><span>{fmtMoney(order.total, currency)}</span></div>
                {order.refunded > 0 && (
                  <div className="totals-row" style={{ color: 'var(--red)' }}><span>Refunded</span><span>-{fmtMoney(order.refunded, currency)}</span></div>
                )}
              </div>
              {order.notes && (
                <div className="modal__section">
                  <h4>Order notes</h4>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{order.notes}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
