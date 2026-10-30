import { useEffect, useRef, useState } from 'react';
import { API } from '../lib/api.js';
import { useDashboard } from '../context/DashboardContext.jsx';
import { fmtMoney, fmtDate, titleCase } from '../lib/format.js';
import { EmptyState, ErrorState, TableSkeletonRows } from '../components/States.jsx';
import OrderModal from '../components/OrderModal.jsx';

const STATUS_OPTIONS = [
  ['', 'All statuses'], ['pending', 'Pending payment'], ['processing', 'Processing'],
  ['on-hold', 'On hold'], ['completed', 'Completed'], ['cancelled', 'Cancelled'],
  ['refunded', 'Refunded'], ['failed', 'Failed'],
];

export default function Orders() {
  const { range, currency } = useDashboard();
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [payment, setPayment] = useState('');
  const [paymentOptions, setPaymentOptions] = useState([]);
  const [sort, setSort] = useState('date');
  const [dir, setDir] = useState('desc');
  const [openOrderId, setOpenOrderId] = useState(null);
  const searchTimer = useRef(null);
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => { setPage(1); }, [range, status, payment, search, sort, dir]);

  useEffect(() => {
    let cancelled = false;
    setRows(null); setError(null);
    API.orders(range, { page, perPage, status, payment, search, sort, dir }).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setRows(res.data.rows);
        setTotal(res.data.total);
        if (!paymentOptions.length && res.data.rows.length) {
          setPaymentOptions([...new Set(res.data.rows.map((r) => r.payment_method))]);
        }
      } else {
        setError(res.error);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, page, status, payment, search, sort, dir]);

  function handleSearchInput(v) {
    setSearchInput(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(v.trim()), 350);
  }

  function toggleSort(key) {
    if (sort === key) setDir(dir === 'asc' ? 'desc' : 'asc');
    else { setSort(key); setDir('desc'); }
  }

  const columns = [
    ['id', 'Order'], ['date', 'Date'], ['customer', 'Customer'], ['items', 'Items'],
    ['total', 'Total'], ['refunded', 'Refunded'], ['payment', 'Payment'], ['status', 'Status'],
  ];

  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  return (
    <section className="page is-active">
      <div className="card table-card">
        <div className="table-toolbar">
          <div className="search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input type="text" className="search-input" placeholder="Search order #, customer, email, product" value={searchInput} onChange={(e) => handleSearchInput(e.target.value)} />
          </div>
          <div className="filter-row">
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select className="select" value={payment} onChange={(e) => setPayment(e.target.value)}>
              <option value="">All payment methods</option>
              {paymentOptions.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                {columns.map(([key, label]) => (
                  <th key={key} className={sort === key ? 'is-sorted' : ''} onClick={() => toggleSort(key)}>
                    {label}{sort === key ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {error && <tr><td colSpan={8}><ErrorState error={error} heading="Orders could not be loaded" onRetry={() => setPage((p) => p)} /></td></tr>}
              {!error && !rows && <TableSkeletonRows cols={8} />}
              {!error && rows && rows.length === 0 && <tr><td colSpan={8}><EmptyState message="No sales data found for the selected reporting period." /></td></tr>}
              {!error && rows && rows.map((o) => {
                const itemsLabel = o.items.length === 1 ? o.items[0].name : `${o.items[0]?.name || ''} +${o.items.length - 1} more`;
                return (
                  <tr key={o.id} onClick={() => setOpenOrderId(o.id)}>
                    <td className="cell-primary">#{o.id}</td>
                    <td className="cell-mono">{fmtDate(o.date)}</td>
                    <td>
                      <div className="cell-primary">{o.customer.name}</div>
                      <div className="text-muted" style={{ fontSize: 11.5 }}>{o.customer.email}</div>
                    </td>
                    <td title={o.items.map((i) => `${i.name} x${i.qty}`).join(', ')}>{itemsLabel}</td>
                    <td className="cell-mono cell-primary">{fmtMoney(o.total, currency)}</td>
                    <td className={`cell-mono ${o.refunded > 0 ? 'text-red' : ''}`}>{o.refunded > 0 ? fmtMoney(o.refunded, currency) : '—'}</td>
                    <td>{o.payment_method}</td>
                    <td><span className={`status-badge status-${o.status}`}>{titleCase(o.status)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="table-pagination">
          <span>{total ? `${start}–${end} of ${total} orders` : 'No orders'}</span>
          <div className="pager-btns">
            <button className="pager-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
            <button className="pager-btn" disabled={page * perPage >= total} onClick={() => setPage((p) => p + 1)}>›</button>
          </div>
        </div>
      </div>
      {openOrderId && <OrderModal orderId={openOrderId} onClose={() => setOpenOrderId(null)} />}
    </section>
  );
}
