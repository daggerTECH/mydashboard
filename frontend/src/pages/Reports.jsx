import { useState } from 'react';
import { API } from '../lib/api.js';
import { useDashboard } from '../context/DashboardContext.jsx';
import { toCsv, downloadCsv } from '../lib/format.js';
import { useToast } from '../context/ToastContext.jsx';

const REPORTS = [
  { id: 'summary', label: 'Sales summary', desc: 'Gross sales, net sales, orders, AOV, refunds, customers.' },
  { id: 'orders', label: 'Orders', desc: 'Full order list for the selected period.' },
  { id: 'products', label: 'Product performance', desc: 'Units, revenue, refunds per product.' },
  { id: 'customers', label: 'Customers', desc: 'Lifetime value and order history per customer.' },
  { id: 'refunds', label: 'Refunds', desc: 'Refund amounts, rates and affected products.' },
];

export default function Reports() {
  const { range, period } = useDashboard();
  const toast = useToast();
  const [busy, setBusy] = useState('');

  const periodLabel = `${range.start} to ${range.end}`;

  async function exportReport(type) {
    setBusy(type);
    toast('Preparing export…');
    try {
      if (type === 'summary') {
        const res = await API.salesSummary(range);
        if (!res.ok) { toast(res.error.message, 'error'); return; }
        const s = res.data;
        const csv = toCsv(
          ['Reporting period', 'Gross sales', 'Net sales', 'Orders', 'Average order value', 'Products sold', 'Refunds', 'New customers', 'Returning customers'],
          [[periodLabel, s.gross_sales.toFixed(2), s.net_sales.toFixed(2), s.total_orders, s.aov.toFixed(2), s.products_sold, s.refunds_total.toFixed(2), s.new_customers, s.returning_customers]]
        );
        downloadCsv(`xl-peptides-sales-summary_${range.start}_${range.end}.csv`, csv);
      } else if (type === 'orders') {
        const res = await API.orders(range, { page: 1, perPage: 10000 });
        if (!res.ok) { toast(res.error.message, 'error'); return; }
        const headers = ['Order ID', 'Date', 'Customer', 'Email', 'Items', 'Subtotal', 'Discount', 'Shipping', 'Tax', 'Total', 'Refunded', 'Payment method', 'Status'];
        const rows = res.data.rows.map((o) => [o.id, o.date, o.customer.name, o.customer.email, o.items.map((i) => `${i.name} x${i.qty}`).join('; '), o.subtotal, o.discount, o.shipping, o.tax, o.total, o.refunded, o.payment_method, o.status]);
        downloadCsv(`xl-peptides-orders_${range.start}_${range.end}.csv`, toCsv(headers, rows));
      } else if (type === 'products') {
        const res = await API.products(range, { page: 1, perPage: 10000 });
        if (!res.ok) { toast(res.error.message, 'error'); return; }
        const headers = ['Product', 'SKU', 'Units sold', 'Gross sales', 'Refunds', 'Net sales', 'Avg. price', '% of sales'];
        const rows = res.data.rows.map((p) => [p.name, p.sku, p.units, p.gross.toFixed(2), p.refunds.toFixed(2), p.net.toFixed(2), p.aov.toFixed(2), (p.share * 100).toFixed(2) + '%']);
        downloadCsv(`xl-peptides-products_${range.start}_${range.end}.csv`, toCsv(headers, rows));
      } else if (type === 'customers') {
        const res = await API.customers(range, { page: 1, perPage: 10000 });
        if (!res.ok) { toast(res.error.message, 'error'); return; }
        const headers = ['Customer', 'Email', 'Orders', 'Avg. order value', 'Lifetime revenue', 'Last purchase'];
        const rows = res.data.rows.map((c) => [c.name, c.email, c.orders, c.aov.toFixed(2), c.ltv.toFixed(2), c.last_purchase]);
        downloadCsv(`xl-peptides-customers_${range.start}_${range.end}.csv`, toCsv(headers, rows));
      } else if (type === 'refunds') {
        const res = await API.refundSummary(range);
        if (!res.ok) { toast(res.error.message, 'error'); return; }
        const r = res.data;
        const headers = ['Reporting period', 'Total refunded', 'Refunded orders', 'Refund rate', 'Total discounts', 'Avg. discount', 'Sales before discount', 'Sales after discount'];
        const rows = [[periodLabel, r.total_refunded.toFixed(2), r.refunded_orders, (r.refund_rate * 100).toFixed(2) + '%', r.total_discounts.toFixed(2), r.avg_discount.toFixed(2), r.sales_before_discount.toFixed(2), r.sales_after_discount.toFixed(2)]];
        downloadCsv(`xl-peptides-refunds_${range.start}_${range.end}.csv`, toCsv(headers, rows));
      }
      toast('Export downloaded', 'success');
    } catch (e) {
      toast('Export failed: ' + e.message, 'error');
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="page is-active">
      <div className="card panel">
        <div className="panel__title" style={{ marginBottom: 6 }}>Export reports</div>
        <p className="field-note" style={{ marginBottom: 18 }}>
          Reports are generated from the currently selected reporting period (<strong>{period === 'custom' ? periodLabel : periodLabel}</strong>). CSV output is escaped to prevent spreadsheet formula injection.
        </p>
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {REPORTS.map((r) => (
            <div className="card" style={{ padding: 18 }} key={r.id}>
              <div className="kpi-card__label">{r.label}</div>
              <p className="field-note">{r.desc}</p>
              <button className="btn btn-primary w-full mt-16" disabled={busy === r.id} onClick={() => exportReport(r.id)}>
                {busy === r.id ? 'Preparing…' : 'Download CSV'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
