import { useEffect, useRef, useState } from 'react';
import { API } from '../lib/api.js';
import { useDashboard } from '../context/DashboardContext.jsx';
import { fmtMoney, fmtInt } from '../lib/format.js';
import { COLORS } from '../lib/chartTheme.js';
import BarChart from '../components/charts/BarChart.jsx';
import { EmptyState, ErrorState, TableSkeletonRows } from '../components/States.jsx';

const SORT_OPTIONS = [
  ['revenue', 'Highest revenue'], ['units', 'Most units sold'], ['aov', 'Highest avg. selling price'],
  ['refunds', 'Most refunded'], ['lowest', 'Lowest performing'],
];

export default function Products() {
  const { range, currency } = useDashboard();
  const [top, setTop] = useState(null);
  const [topError, setTopError] = useState(null);

  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState('revenue');
  const searchTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setTop(null); setTopError(null);
    API.topProducts(range, 10).then((res) => { if (!cancelled) res.ok ? setTop(res.data) : setTopError(res.error); });
    return () => { cancelled = true; };
  }, [range]);

  useEffect(() => { setPage(1); }, [range, search, sort]);

  useEffect(() => {
    let cancelled = false;
    setRows(null); setError(null);
    API.products(range, { page, perPage, search, sort }).then((res) => {
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
      <div className="card panel">
        <div className="panel__header"><div className="panel__title">Top 10 products by revenue</div></div>
        {topError && <ErrorState error={topError} heading="Chart data unavailable" />}
        {!topError && !top && <div className="skeleton" style={{ height: 320 }} />}
        {top && top.length === 0 && <EmptyState message="No product sales found for the selected reporting period." />}
        {top && top.length > 0 && <BarChart labels={top.map((p) => p.name)} data={top.map((p) => p.gross)} color={COLORS.mint} horizontal />}
      </div>

      <div className="section-heading"><h3>Product performance</h3><span className="hint">Units, revenue and refunds for the selected period</span></div>
      <div className="card table-card">
        <div className="table-toolbar">
          <div className="search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input type="text" className="search-input" placeholder="Search product or SKU" value={searchInput} onChange={(e) => handleSearchInput(e.target.value)} />
          </div>
          <div className="filter-row">
            <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th><th>SKU</th><th>Units sold</th><th>Gross sales</th>
                <th>Refunds</th><th>Net sales</th><th>Avg. price</th><th>% of sales</th>
              </tr>
            </thead>
            <tbody>
              {error && <tr><td colSpan={8}><ErrorState error={error} heading="Product performance could not be loaded" /></td></tr>}
              {!error && !rows && <TableSkeletonRows cols={8} />}
              {!error && rows && rows.length === 0 && <tr><td colSpan={8}><EmptyState message="No products matched the selected period or filters." /></td></tr>}
              {!error && rows && rows.map((p) => (
                <tr key={p.product_id ?? p.id ?? p.name}>
                  <td><div className="product-cell"><div className="product-thumb"></div><span className="cell-primary">{p.name}</span></div></td>
                  <td className="text-muted">{p.sku}</td>
                  <td className="cell-mono">{fmtInt(p.units)}</td>
                  <td className="cell-mono cell-primary">{fmtMoney(p.gross, currency)}</td>
                  <td className={`cell-mono ${p.refunds > 0 ? 'text-red' : ''}`}>{p.refunds > 0 ? fmtMoney(p.refunds, currency) : '—'}</td>
                  <td className="cell-mono">{fmtMoney(p.net, currency)}</td>
                  <td className="cell-mono">{fmtMoney(p.aov, currency)}</td>
                  <td className="cell-mono">{(p.share * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <span>{total ? `${start}–${end} of ${total} products` : 'No products'}</span>
          <div className="pager-btns">
            <button className="pager-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
            <button className="pager-btn" disabled={page * perPage >= total} onClick={() => setPage((p) => p + 1)}>›</button>
          </div>
        </div>
      </div>
    </section>
  );
}
