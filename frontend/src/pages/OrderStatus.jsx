import { useEffect, useState } from 'react';
import { API } from '../lib/api.js';
import { useDashboard } from '../context/DashboardContext.jsx';
import { fmtMoney, fmtInt, titleCase } from '../lib/format.js';
import BarChart from '../components/charts/BarChart.jsx';
import { COLORS } from '../lib/chartTheme.js';
import { ErrorState } from '../components/States.jsx';

export default function OrderStatus() {
  const { range, currency } = useDashboard();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null); setError(null);
    API.orderStatusBreakdown(range).then((res) => { if (!cancelled) res.ok ? setRows(res.data) : setError(res.error); });
    return () => { cancelled = true; };
  }, [range]);

  const nonZero = rows ? rows.filter((r) => r.count > 0) : [];

  return (
    <section className="page is-active">
      <div className="panel-row">
        <div className="card panel">
          <div className="panel__header"><div className="panel__title">Orders by status</div></div>
          {error && <ErrorState error={error} heading="Order status data could not be loaded" />}
          {!error && !rows && <div className="skeleton" style={{ height: 320 }} />}
          {!error && rows && <BarChart labels={nonZero.map((r) => titleCase(r.status))} data={nonZero.map((r) => r.count)} color={COLORS.blue} />}
        </div>
        <div className="card panel">
          <div className="panel__header"><div className="panel__title">Status breakdown</div></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Status</th><th>Orders</th><th>% of orders</th><th>Order value</th></tr></thead>
              <tbody>
                {error && <tr><td colSpan={4}><ErrorState error={error} heading="Order status data could not be loaded" /></td></tr>}
                {!error && !rows && <tr><td colSpan={4}><div className="skeleton" style={{ height: 120 }} /></td></tr>}
                {!error && rows && rows.map((r) => (
                  <tr key={r.status}>
                    <td><span className={`status-badge status-${r.status}`}>{titleCase(r.status)}</span></td>
                    <td className="cell-mono">{fmtInt(r.count)}</td>
                    <td className="cell-mono">{(r.pct * 100).toFixed(1)}%</td>
                    <td className="cell-mono">{fmtMoney(r.value, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="field-note mt-16">Order value includes all orders in each status. Only completed and processing orders are counted as recognized revenue elsewhere in this dashboard.</p>
        </div>
      </div>
    </section>
  );
}
