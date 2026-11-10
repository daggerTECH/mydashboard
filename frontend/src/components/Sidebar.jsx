import { useDashboard } from '../context/DashboardContext.jsx';

const NAV_SECTIONS = [
  {
    label: 'Analytics',
    items: [
      { id: 'overview', label: 'Sales Overview', icon: <path d="M3 12h4v9H3zM10 7h4v14h-4zM17 3h4v18h-4z" /> },
      { id: 'revenue', label: 'Revenue Analytics', icon: <><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></> },
      { id: 'orders', label: 'Orders', icon: <><path d="M6 2l1.5 4h9L18 2" /><path d="M3.5 6h17l-1.6 12.4A2 2 0 0 1 17 20H7a2 2 0 0 1-2-1.6L3.5 6z" /></> },
      { id: 'products', label: 'Products', icon: <><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></> },
      { id: 'customers', label: 'Customers', icon: <><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><circle cx="17.5" cy="8.5" r="2.4" /><path d="M15.2 14.3c2.7.5 4.3 2.4 4.3 5.3" /></> },
      { id: 'refunds', label: 'Refunds & Discounts', icon: <><path d="M3 9a9 9 0 1 1 1.5 5" /><path d="M3 4v5h5" /></> },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { id: 'marketing', label: 'Marketing & Ads', icon: <><path d="M3 11l18-7-7 18-2-8-9-3z" /></> },
    ],
  },
  {
    label: 'Reports',
    items: [
      { id: 'payment-methods', label: 'Payment Methods', icon: <><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></> },
      { id: 'order-status', label: 'Order Status', icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 2" /></> },
      { id: 'reports', label: 'Export Reports', icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" /></> },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'settings', label: 'Settings', icon: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></> },
    ],
  },
];

export default function Sidebar({ currentPage, onNavigate, isOpen, onClose }) {
  const { connection } = useDashboard();
  const dotClass = connection.status === 'connected' ? 'dot' : connection.status === 'demo' ? 'dot is-pending' : connection.status === 'connecting' ? 'dot is-pending' : 'dot is-offline';
  const label = connection.status === 'connected' ? 'Connected' : connection.status === 'demo' ? 'Demo data' : connection.status === 'connecting' ? 'Connecting…' : 'Disconnected';

  return (
    <>
      <div className={`sidebar-backdrop ${isOpen ? 'is-open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'is-open' : ''}`}>
        <div className="sidebar__brand">
          <img src="/logo-on-dark.png" alt="XL Peptides" height="46" />
        </div>
        <nav className="sidebar__nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <div className="sidebar__section-label">{section.label}</div>
              {section.items.map((item) => (
                <div
                  key={item.id}
                  className={`nav-item ${currentPage === item.id ? 'is-active' : ''}`}
                  onClick={() => onNavigate(item.id)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{item.icon}</svg>
                  {item.label}
                </div>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar__footer">
          <span className="store-pill"><span className={dotClass}></span><span>{label}</span></span>
        </div>
      </aside>
    </>
  );
}
