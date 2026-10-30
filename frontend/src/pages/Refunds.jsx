import { useEffect, useState } from 'react';
import { API } from '../lib/api.js';
import { useDashboard } from '../context/DashboardContext.jsx';
import { fmtMoney } from '../lib/format.js';
import LineChart from '../components/charts/LineChart.jsx';
import { COLORS } from '../lib/chartTheme.js';
import { EmptyState, ErrorState, KpiSkeletonGrid } from '../components/States.jsx';
import KpiCard from '../components/KpiCard.jsx';

export default function Refunds() {
  const { range, currency } = useDashboard();
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState(null);
  const [trend, setTrend] = useState(null);
  const [trendError, setTrendError] = useState(null);
  const [products, setProducts] = useState(null);
  const [productsError, setProductsError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setSummary(null); setSummaryError(null);
    API.refundSummary(range).then((res) => { if (!cancelled) res.ok ? setSummary(res.data) : setSummaryError(res.error); });
    return () => { cancelled = true; };
  }, [range]);

  useEffect(() => {
    let cancelled = false;
    setTrend(null); setTrendError(null);
    API.refundTrend(range, 'daily').then((res) => { if (!cancelled) res.ok ? setTrend(res.data) : setTrendError(res.error); });
    return () => { cancelled = true; };
  }, [range]);

  useEffect(() => {
    let cancelled = false;
    setProducts(null); setProductsError(null);
    API.refundedProducts(range, 8).then((res) => { if (!cancelled) res.ok ? setProducts(res.data) : setProductsError(res.error); });
    return () => { cancelled = true; };
  }, [range]);

  return (
    <section className="page is-active">
      {summaryError && <div className="card" style={{ padding: 0, marginBottom: 16 }}><ErrorState error={summaryError} heading="Refund metrics could not be loaded" /></div>}
      {!summaryError && !summary && <KpiSkeletonGrid count={4} />}
      {summary && (
        <div className="kpi-grid">
          <KpiCard label="Total refunded" value={fmtMoney(summary.total_refunded, currency)} valueClass="text-red" sub={`${summary.refunded_orders} orders · ${(summary.refund_rate * 100).toFixed(1)}% rate`} />
          <KpiCard label="Total discounts granted" value={fmtMoney(summary.total_discounts, currency)} />
          <KpiCard label="Avg. discount per order" value={fmtMoney(summary.avg_discount, currency)} />
          <KpiCard label="Sales before → after discount" value={`${fmtMoney(summary.sales_before_discount, currency)} → ${fmtMoney(summary.sales_after_discount, currency)}`} />
        </div>
      )}

      <div className="panel-row mt-16">
        <div className="card panel">
          <div className="panel__header"><div className="panel__title">Refund trend</div></div>
          {trendError && <ErrorState error={trendError} heading="Chart data unavailable" />}
          {!trendError && !trend && <div className="skeleton" style={{ height: 320 }} />}
          {trend && <LineChart labels={trend.labels} datasets={[{ label: 'Refunded', data: trend.gross, color: COLORS.red }]} />}
        </div>
        <div className="card panel">
          <div className="panel__header"><div className="panel__title">Most refunded products</div></div>
          {productsError && <ErrorState error={productsError} heading="Could not load refunded products" />}
          {!productsError && !products && <div className="skeleton" style={{ height: 180 }} />}
          {products && products.length === 0 && <EmptyState message="No refunds recorded for the selected period." />}
          {products && products.length > 0 && (() => {
            const max = Math.max(...products.map((p) => p.amount));
            return (
              <div className="bar-list">
                {products.map((p) => (
                  <div className="bar-row" key={p.name}>
                    <div className="bar-label" title={p.name}>{p.name}</div>
                    <div className="bar-track"><div className="bar-fill" style={{ background: 'linear-gradient(90deg,#F2667A,#E8B14F)', width: `${max ? (p.amount / max) * 100 : 0}%` }} /></div>
                    <div className="bar-value">{fmtMoney(p.amount, currency)}</div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </section>
  );
}
