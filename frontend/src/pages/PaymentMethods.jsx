import { useEffect, useState } from 'react';
import { API } from '../lib/api.js';
import { useDashboard } from '../context/DashboardContext.jsx';
import { fmtMoney, fmtInt } from '../lib/format.js';
import DoughnutChart from '../components/charts/DoughnutChart.jsx';
import { EmptyState, ErrorState } from '../components/States.jsx';

export default function PaymentMethods() {
  const { range, currency } = useDashboard();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null); setError(null);
    API.paymentMethodBreakdown(range).then((res) => { if (!cancelled) res.ok ? setRows(res.data) : setError(res.error); });
    return () => { cancelled = true; };
  }, [range]);

  return (
    <section className="page is-active">
      <div className="panel-row">
        <div className="card panel">
          <div className="panel__header"><div className="panel__title">Sales by payment method</div></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Payment method</th><th>Orders</th><th>Total sales</th><th>Net sales</th><th>Avg. order value</th><th>% of sales</th></tr></thead>
              <tbody>
                {error && <tr><td colSpan={6}><ErrorState error={error} heading="Payment data could not be loaded" /></td></tr>}
                {!error && !rows && <tr><td colSpan={6}><div className="skeleton" style={{ height: 80 }} /></td></tr>}
                {!error && rows && rows.length === 0 && <tr><td colSpan={6}><EmptyState message="No sales found for the selected reporting period." /></td></tr>}
                {!error && rows && rows.map((r) => (
                  <tr key={r.method}>
                    <td className="cell-primary">{r.method}</td>
                    <td className="cell-mono">{fmtInt(r.orders)}</td>
                    <td className="cell-mono">{fmtMoney(r.total, currency)}</td>
                    <td className="cell-mono">{fmtMoney(r.net, currency)}</td>
                    <td className="cell-mono">{fmtMoney(r.aov, currency)}</td>
                    <td className="cell-mono">{(r.pct * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card panel">
          <div className="panel__header"><div className="panel__title">Share of sales</div></div>
          {!error && rows && rows.length > 0 && <DoughnutChart labels={rows.map((r) => r.method)} data={rows.map((r) => r.total)} />}
          {!error && rows && rows.length === 0 && <EmptyState message="No sales found for the selected reporting period." />}
          {!error && !rows && <div className="skeleton" style={{ height: 260 }} />}
        </div>
      </div>
    </section>
  );
}
