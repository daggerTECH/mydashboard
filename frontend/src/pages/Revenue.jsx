import { useEffect, useState } from 'react';
import { API } from '../lib/api.js';
import { useDashboard } from '../context/DashboardContext.jsx';
import LineChart from '../components/charts/LineChart.jsx';
import { COLORS } from '../lib/chartTheme.js';
import { ErrorState } from '../components/States.jsx';

export default function Revenue() {
  const { range, revAnalyticsGranularity, setRevAnalyticsGranularity } = useDashboard();
  const [series, setSeries] = useState(null);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setSeries(null); setError(null);
    API.revenueSeries(range, revAnalyticsGranularity).then((res) => {
      if (cancelled) return;
      res.ok ? setSeries(res.data) : setError(res.error);
    });
    return () => { cancelled = true; };
  }, [range, revAnalyticsGranularity, tick]);

  return (
    <section className="page is-active">
      <div className="card panel">
        <div className="panel__header">
          <div className="panel__title">Revenue Analytics</div>
          <div className="chip-group">
            {['daily', 'weekly', 'monthly'].map((g) => (
              <button key={g} className={`chip ${revAnalyticsGranularity === g ? 'is-active' : ''}`} onClick={() => setRevAnalyticsGranularity(g)}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {error && <ErrorState error={error} heading="Chart data unavailable" onRetry={() => setTick((t) => t + 1)} />}
        {!error && !series && <div className="skeleton" style={{ height: 400 }} />}
        {series && (
          <>
            <LineChart
              height={400}
              labels={series.labels}
              datasets={[
                { label: 'Gross sales', data: series.gross, color: COLORS.blue },
                { label: 'Net sales', data: series.net, color: COLORS.mint },
                { label: 'Order count', data: series.orders, color: COLORS.amber, yAxisID: 'y1', fill: false },
              ]}
            />
            <div className="legend-toggle">
              <label><span className="legend-swatch" style={{ background: COLORS.blue }}></span>Gross sales</label>
              <label><span className="legend-swatch" style={{ background: COLORS.mint }}></span>Net sales</label>
              <label><span className="legend-swatch" style={{ background: COLORS.amber }}></span>Order count</label>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
