import { useState } from 'react';
import { DashboardProvider, useDashboard } from './context/DashboardContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import Login from './components/Login.jsx';

import Overview from './pages/Overview.jsx';
import Revenue from './pages/Revenue.jsx';
import Orders from './pages/Orders.jsx';
import Products from './pages/Products.jsx';
import Customers from './pages/Customers.jsx';
import Refunds from './pages/Refunds.jsx';
import Marketing from './pages/Marketing.jsx';
import PaymentMethods from './pages/PaymentMethods.jsx';
import OrderStatus from './pages/OrderStatus.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';

const PAGES = {
  overview: Overview, revenue: Revenue, orders: Orders, products: Products,
  customers: Customers, refunds: Refunds, marketing: Marketing, 'payment-methods': PaymentMethods,
  'order-status': OrderStatus, reports: Reports, settings: Settings,
};

function DashboardShell() {
  const { user, authLoading, isDemo, refreshAll } = useDashboard();
  const [currentPage, setCurrentPage] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (authLoading) return <div className="app-loading">Loading…</div>;
  if (!user && !isDemo) return <Login />;

  const Page = PAGES[currentPage] || Overview;

  function navigate(page) {
    setCurrentPage(page);
    setSidebarOpen(false);
  }

  return (
    <div className="app-shell">
      <Sidebar currentPage={currentPage} onNavigate={navigate} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Topbar
        currentPage={currentPage}
        onMenuToggle={() => setSidebarOpen((o) => !o)}
        onExport={() => navigate('reports')}
        onRefresh={refreshAll}
      />
      <main className="main">
        {isDemo && (
          <div className="inline-note" style={{ margin: '0 0 16px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M12 9v4" /><circle cx="12" cy="12" r="9" /><path d="M12 16h.01" />
            </svg>
            <span>
              <strong>Demo data</strong> — this dashboard is not yet connected to WooCommerce. Showing generated sample figures so you can preview the UI.
              Set <code>VITE_DEMO_MODE=false</code> and point <code>VITE_API_BASE_URL</code> at your deployed backend to use real data.
            </span>
          </div>
        )}
        <Page />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <DashboardProvider>
        <DashboardShell />
      </DashboardProvider>
    </ToastProvider>
  );
}
