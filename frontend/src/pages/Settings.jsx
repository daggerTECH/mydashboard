import { useEffect, useState } from 'react';
import { API } from '../lib/api.js';
import { useDashboard } from '../context/DashboardContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Settings() {
  const { connection, refreshAll, lastSync, logout, isDemo } = useDashboard();
  const toast = useToast();
  const [store, setStore] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    API.storeSettings().then((res) => { if (res.ok) setStore(res.data); });
  }, [connection.status]);

  async function handleRefresh() {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
    toast('Data refreshed', 'success');
  }

  const connLabel = connection.status === 'connected' ? 'Connected'
    : connection.status === 'demo' ? 'Demo mode (not connected)'
    : connection.status === 'connecting' ? 'Connecting…' : 'Disconnected';

  return (
    <section className="page is-active">
      <div className="settings-grid">
        <div className="card panel">
          <div className="panel__title" style={{ marginBottom: 16 }}>Store configuration</div>
          <div className="field"><label>WooCommerce store URL</label><input type="text" disabled value={store?.store_url || ''} placeholder="Loaded from backend .env" /></div>
          <div className="field"><label>Store currency</label><input type="text" disabled value={store?.currency || ''} /></div>
          <div className="field"><label>Store timezone</label><input type="text" disabled value={store?.timezone || ''} /></div>
          <div className="field"><label>Reporting date format</label><input type="text" disabled value={store?.date_format || ''} /></div>
          <p className="field-note">These values are retrieved from the WooCommerce store settings endpoint via the Express backend and cannot be edited here.</p>
        </div>
        <div className="card panel">
          <div className="panel__title" style={{ marginBottom: 16 }}>Data synchronization</div>
          <div className="kv-grid" style={{ marginBottom: 16 }}>
            <div className="k">Last successful sync</div><div className="v">{lastSync ? lastSync.toLocaleString() : '—'}</div>
            <div className="k">Connection status</div><div className="v">{connLabel}</div>
          </div>
          <button className="btn btn-primary w-full" disabled={refreshing} onClick={handleRefresh}>
            {refreshing ? 'Refreshing…' : 'Refresh data now'}
          </button>
          {connection.error && <div className="field-note mt-16" style={{ color: 'var(--red)' }}>{connection.error.message}</div>}
        </div>
        <div className="card panel">
          <div className="panel__title" style={{ marginBottom: 10 }}>Security</div>
          <p className="field-note">
            WooCommerce consumer keys and secrets live only in the backend's <code>.env</code> file on Oracle Cloud and are never sent to the browser.
            The frontend authenticates against the backend with an httpOnly session cookie — no tokens are stored in LocalStorage.
          </p>
        </div>
        <div className="card panel">
          <div className="panel__title" style={{ marginBottom: 10 }}>Account</div>
          {isDemo ? (
            <p className="field-note">Demo mode is active — sign-in is bypassed. Set <code>VITE_DEMO_MODE=false</code> to require a real login.</p>
          ) : (
            <button className="btn w-full" onClick={logout}>Sign out</button>
          )}
        </div>
      </div>
    </section>
  );
}
