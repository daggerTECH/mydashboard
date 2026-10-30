export default function KpiCard({ label, value, current, previous, sub, valueClass }) {
  let trendNode = <span className="kpi-card__sub">{sub || ''}</span>;

  if (previous !== undefined) {
    if (!previous) {
      trendNode = <><span className="trend is-flat">—</span><span className="kpi-card__sub">vs. previous period</span></>;
    } else {
      const pct = ((current - previous) / Math.abs(previous)) * 100;
      const cls = pct > 0.5 ? 'is-up' : pct < -0.5 ? 'is-down' : 'is-flat';
      const arrow = pct > 0.5 ? '↑' : pct < -0.5 ? '↓' : '→';
      trendNode = <><span className={`trend ${cls}`}>{arrow} {Math.abs(pct).toFixed(1)}%</span><span className="kpi-card__sub">vs. previous period</span></>;
    }
  }

  return (
    <div className="card kpi-card">
      <div className="kpi-card__label">{label}</div>
      <div className={`kpi-card__value ${valueClass || ''}`}>{value}</div>
      <div className="kpi-card__footer">{trendNode}</div>
    </div>
  );
}
