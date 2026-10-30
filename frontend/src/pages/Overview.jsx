import { useEffect, useState } from 'react';
import { API } from '../lib/api.js';
import { useDashboard } from '../context/DashboardContext.jsx';
import { fmtMoney, fmtInt, titleCase } from '../lib/format.js';
import KpiCard from '../components/KpiCard.jsx';
import LineChart from '../components/charts/LineChart.jsx';
import DoughnutChart from '../components/charts/DoughnutChart.jsx';
import { COLORS } from '../lib/chartTheme.js';
import { EmptyState, ErrorState, KpiSkeletonGrid } from '../components/States.jsx';

export default function Overview() {
  const { range, currency, overviewGranularity, setOverviewGranularity } = useDashboard();
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [revenueError, setRevenueError] = useState(null);
  const [statusMix, setStatusMix] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const [topProducts, setTopProducts] = useState(null);
  const [topProductsError, setTopProductsError] = useState(null);
  const [loadTick, setLoadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setSummary(null); setSummaryError(null);
    API.salesSummary(range).then((res) => { if (!cancelled) res.ok ? setSummary(res.data) : setSummaryError(res.error); });
    return () => { cancelled = true; };
  }, [range, loadTick]);

  useEffect(() => {
    let cancelled = false;
    setRevenue(null); setRevenueError(null);
    API.revenueSeries(range, overviewGranularity).then((res) => { if (!cancelled) res.ok ? setRevenue(res.data) : setRevenueError(res.error); });
    return () => { cancelled = true; };
  }, [range, overviewGranularity, loadTick]);

  useEffect(() => {
    let cancelled = false;
    setStatusMix(null); setStatusError(null);
    API.orderStatusBreakdown(range).then((res) => { if (!cancelled) res.ok ? setStatusMix(res.data) : setStatusError(res.error); });
    return () => { cancelled = true; };
  }, [range, loadTick]);

  useEffect(() => {
    let cancelled = false;
    setTopProducts(null); setTopProductsError(null);
    API.topProducts(range, 6).then((res) => { if (!cancelled) res.ok ? setTopProducts(res.data) : setTopProductsError(res.error); });
    return () => { cancelled = true; };
  }, [range, loadTick]);

  function retry() { setLoadTick((t) => t + 1); }

  return (
    <section className="page is-active">
      {summaryError && <div className="card" style={{ padding: 0, marginBottom: 16 }}><ErrorState error={summaryError} heading="Sales figures could not be loaded" onRetry={retry} /></div>}
      {!summaryError && !summary && <KpiSkeletonGrid />}
      {summary && (
        <div className="kpi-grid">
          <KpiCard label="Gross sales" value={fmtMoney(summary.gross_sales, currency)} current={summary.gross_sales} previous={summary.gross_sales_prev} />
          <KpiCard label="Net sales" value={fmtMoney(summary.net_sales, currency)} current={summary.net_sales} previous={summary.net_sales_prev} />
          <KpiCard label="Total orders" value={fmtInt(summary.total_orders)} current={summary.total_orders} previous={summary.total_orders_prev} />
          <KpiCard label="Average order value" value={fmtMoney(summary.aov, currency)} current={summary.aov} previous={summary.aov_prev} />
          <KpiCard label="Products sold" value={fmtInt(summary.products_sold)} current={summary.products_sold} previous={summary.products_sold_prev} />
          <KpiCard label="Refunds" value={fmtMoney(summary.refunds_total, currency)} sub={`${summary.refunded_orders} orders · ${(summary.refund_rate * 100).toFixed(1)}% rate`} />
          <KpiCard label="Customers" value={fmtInt(summary.customers_total)} sub={`${summary.new_customers ?? '—'} new · ${summary.returning_customers ?? '—'} returning`} />
          <KpiCard label="Conversion rate" value={summary.conversion_rate_available ? (summary.conversion_rate * 100).toFixed(2) + '%' : '—'} sub={summary.conversion_rate_available ? 'From connected analytics' : 'Requires Google Analytics 4 integration'} />
        </div>
      )}

      <div className="section-heading"><h3>Revenue trend</h3><span className="hint">Gross vs. net sales for the selected period</span></div>
      <div className="panel-row">
        <div className="card panel">
          <div className="panel__header">
            <div className="panel__title">Revenue over time</div>
            <div className="chip-group">
              {['daily', 'weekly', 'monthly'].map((g) => (
                <button key={g} className={`chip ${overviewGranularity === g ? 'is-active' : ''}`} onClick={() => setOverviewGranularity(g)}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {revenueError && <ErrorState error={revenueError} heading="Chart data unavailable" onRetry={retry} />}
          {!revenueError && !revenue && <div className="skeleton" style={{ height: 320 }} />}
          {revenue && (
            <>
              <LineChart
                labels={revenue.labels}
                datasets={[
                  { label: 'Gross sales', data: revenue.gross, color: COLORS.blue },
                  { label: 'Net sales', data: revenue.net, color: COLORS.mint },
                ]}
              />
              <div className="legend-toggle">
                <label><span className="legend-swatch" style={{ background: COLORS.blue }}></span>Gross sales</label>
                <label><span className="legend-swatch" style={{ background: COLORS.mint }}></span>Net sales</label>
              </div>
            </>
          )}
        </div>
        <div className="card panel">
          <div className="panel__header"><div className="panel__title">Order status mix</div></div>
          {statusError && <ErrorState error={statusError} heading="Chart data unavailable" onRetry={retry} />}
          {!statusError && !statusMix && <div className="skeleton" style={{ height: 260 }} />}
          {statusMix && (() => {
            const nonZero = statusMix.filter((r) => r.count > 0);
            return <DoughnutChart labels={nonZero.map((r) => titleCase(r.status))} data={nonZero.map((r) => r.count)} />;
          })()}
        </div>
      </div>

      <div className="section-heading"><h3>Top products this period</h3><span className="hint">By gross revenue</span></div>
      <div className="card panel">
        {topProductsError && <ErrorState error={topProductsError} heading="Could not load this section" onRetry={retry} />}
        {!topProductsError && !topProducts && <div className="skeleton" style={{ height: 180 }} />}
        {topProducts && topProducts.length === 0 && <EmptyState message="No product sales found for the selected reporting period." />}
        {topProducts && topProducts.length > 0 && (() => {
          const max = Math.max(...topProducts.map((r) => r.gross));
          return (
            <div className="bar-list">
              {topProducts.map((r) => (
                <div className="bar-row" key={r.product_id ?? r.id ?? r.name}>
                  <div className="bar-label" title={r.name}>{r.name}</div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${max ? (r.gross / max) * 100 : 0}%` }} /></div>
                  <div className="bar-value">{fmtMoney(r.gross, currency)}</div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </section>
  );
}
