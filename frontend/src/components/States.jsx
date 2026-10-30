export function EmptyState({ message }) {
  return (
    <div className="empty-state">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" />
      </svg>
      <p>{message}</p>
    </div>
  );
}

export function ErrorState({ error, heading = 'Could not load data', onRetry }) {
  const msg = error?.message || 'Something went wrong while loading this data.';
  return (
    <div className="error-state">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" /><line x1="12" y1="8" x2="12" y2="13" /><line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <strong style={{ color: 'var(--text-primary)', fontSize: 13.5, marginBottom: 4 }}>{heading}</strong>
      <p>{msg}</p>
      {onRetry && <button className="btn" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function KpiSkeletonGrid({ count = 8 }) {
  return (
    <div className="kpi-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div className="card kpi-card" key={i}>
          <div className="skeleton" style={{ height: 12, width: '50%' }} />
          <div className="skeleton kpi-card__skeleton" />
          <div className="skeleton" style={{ height: 12, width: '40%', marginTop: 10 }} />
        </div>
      ))}
    </div>
  );
}

export function TableSkeletonRows({ cols, rows = 8 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((__, c) => (
            <td key={c}><div className="skeleton" style={{ height: 14, width: '80%' }} /></td>
          ))}
        </tr>
      ))}
    </>
  );
}
