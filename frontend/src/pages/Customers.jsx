import { useEffect, useRef, useState } from 'react';
import { API } from '../lib/api.js';
import { useDashboard } from '../context/DashboardContext.jsx';
import { fmtMoney, fmtInt, fmtDate } from '../lib/format.js';
import { EmptyState, ErrorState, KpiSkeletonGrid, TableSkeletonRows } from '../components/States.jsx';
import KpiCard from '../components/KpiCard.jsx';

const SORT_OPTIONS = [
  ['ltv', 'Highest lifetime revenue'], ['orders', 'Most orders'],
  ['recent', 'Most recent purchase'], ['aov', 'Highest avg. order value'],
];

export default function Customers() {
  const { range, currency } = useDashboard();
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState(null);

  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState('ltv');
  const searchTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setSummary(null); setSummaryError(null);
    API.customerSummary(range).then((res) => { if (!cancelled) res.ok ? setSummary(res.data) : setSummaryError(res.error); });
    return () => { cancelled = true; };
  }, [range]);

  useEffect(() => { setPage(1); }, [range, search, sort]);

  useEffect(() => {
    let cancelled = false;
    setRows(null); setError(null);
    API.customers(range, { page, perPage, search, sort }).then((res) => {
      if (cancelled) return;
      if (res.ok) { setRows(res.data.rows); setTotal(res.data.total); } else setError(res.error);
    });
    return () => { cancelled = true; };
  }, [range, page, search, sort]);

  function handleSearchInput(v) {
    setSearchInput(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(v.trim()), 350);
  }

  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  return (
    <section className="page is-active">
      {summaryError && <div className="card" style={{ padding: 0, marginBottom: 16 }}><ErrorState error={summaryError} heading="Customer metrics could not be loaded" /></div>}
      {!summaryError && !summary && <KpiSkeletonGrid count={4} />}
      {summary && (
        <div className="kpi-grid">
          <KpiCard label="Total customers" value={fmtInt(summary.total_customers)} />
          <KpiCard label="New customers" value={fmtInt(summary.new_customers)} />
          <KpiCard label="Returning customers" value={fmtInt(summary.returning_customers)} />
          <KpiCard label="Avg. lifetime value" value={fmtMoney(summary.avg_ltv, currency)} />
        </div>
      )}

      <div className="section-heading"><h3>Customer list</h3><span className="hint">Lifetime value based on completed and processing orders</span></div>
      <div className="card table-card">
        <div className="table-toolbar">
          <div className="search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input type="text" className="search-input" placeholder="Search name or email" value={searchInput} onChange={(e) => handleSearchInput(e.target.value)} />
          </div>
          <div className="filter-row">
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>Customer</th><th>Orders</th><th>Avg. order value</th><th>Lifetime revenue</th><th>Last purchase</th></tr></thead>
            <tbody>
              {error && <tr><td colSpan={5}><ErrorState error={error} heading="Customers could not be loaded" /></td></tr>}
              {!error && !rows && <TableSkeletonRows cols={5} />}
              {!error && rows && rows.length === 0 && <tr><td colSpan={5}><EmptyState message="No customers found for the selected reporting period." /></td></tr>}
              {!error && rows && rows.map((c) => (
                <tr key={c.email || c.name}>
                  <td>
                    <div className="cell-primary">{c.name}</div>
                    <div className="text-muted" style={{ fontSize: 11.5 }}>{c.email}</div>
                  </td>
                  <td className="cell-mono">{fmtInt(c.orders)}</td>
                  <td className="cell-mono">{fmtMoney(c.aov, currency)}</td>
                  <td className="cell-mono cell-primary">{fmtMoney(c.ltv, currency)}</td>
                  <td className="cell-mono">{fmtDate(c.last_purchase)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <span>{total ? `${start}–${end} of ${total} customers` : 'No customers'}</span>
          <div className="pager-btns">
            <button className="pager-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
            <button className="pager-btn" disabled={page * perPage >= total} onClick={() => setPage((p) => p + 1)}>›</button>
          </div>
        </div>
      </div>
    </section>
  );
}
