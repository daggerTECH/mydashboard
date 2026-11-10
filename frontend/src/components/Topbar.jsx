import { useState } from 'react';
import { useDashboard } from '../context/DashboardContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const PAGE_TITLES = {
  overview: ['Sales Overview', 'Revenue, orders and customer performance at a glance'],
  revenue: ['Revenue Analytics', 'Gross and net revenue trends over time'],
  orders: ['Orders', 'Browse, search and inspect individual orders'],
  products: ['Products', 'Product-level sales performance'],
  customers: ['Customers', 'Purchasing behavior and lifetime value'],
  refunds: ['Refunds & Discounts', 'Refund trends and discount impact'],
  marketing: ['Marketing & Ads', 'Channel attribution, ad spend, and ACOS/ROAS/TACOS'],
  'payment-methods': ['Payment Methods', 'Sales performance by payment method'],
  'order-status': ['Order Status', 'Distribution of orders across statuses'],
  reports: ['Export Reports', 'Download CSV reports for the selected period'],
  settings: ['Settings', 'Store configuration and connection management'],
};

const PERIOD_OPTIONS = [
  ['today', 'Today'], ['yesterday', 'Yesterday'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'],
  ['90d', 'Last 90 days'], ['this_month', 'This month'], ['last_month', 'Last month'],
  ['this_year', 'This year'], ['last_year', 'Last year'], ['custom', 'Custom range…'],
];

export default function Topbar({ currentPage, onMenuToggle, onExport, onRefresh }) {
  const { period, setPeriod, lastSync } = useDashboard();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const [title] = PAGE_TITLES[currentPage] || [currentPage];

  async function handleRefresh() {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
    toast('Data refreshed', 'success');
  }

  function handlePeriodChange(e) {
    setPeriod(e.target.value, customStart, customEnd);
  }

  function handleCustomChange(which, value) {
    const s = which === 'start' ? value : customStart;
    const e = which === 'end' ? value : customEnd;
    if (which === 'start') setCustomStart(value); else setCustomEnd(value);
    if (s && e) setPeriod('custom', s, e);
  }

  return (
    <header className="topbar">
      <div className="flex items-center">
        <button className="menu-toggle" aria-label="Toggle menu" onClick={onMenuToggle}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="topbar__left">
          <div className="topbar__title">{title}</div>
          <div className="topbar__meta">Last synced: {lastSync ? lastSync.toLocaleTimeString() : '—'}</div>
        </div>
      </div>
      <div className="topbar__right">
        <select className="select" value={period} onChange={handlePeriodChange} aria-label="Reporting period">
          {PERIOD_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        {period === 'custom' && (
          <span className="flex items-center gap-8">
            <input type="date" className="date-range-input" value={customStart} onChange={(e) => handleCustomChange('start', e.target.value)} />
            <span className="text-muted">–</span>
            <input type="date" className="date-range-input" value={customEnd} onChange={(e) => handleCustomChange('end', e.target.value)} />
          </span>
        )}
        <button className={`btn ${refreshing ? 'is-loading' : ''}`} onClick={handleRefresh} disabled={refreshing}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></svg>
          Refresh
        </button>
        <button className="btn btn-primary" onClick={onExport}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 19h16" /></svg>
          Export
        </button>
      </div>
    </header>
  );
}
