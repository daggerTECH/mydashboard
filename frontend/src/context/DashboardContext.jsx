import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { API } from '../lib/api.js';
import { computeRange } from '../lib/format.js';

const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  // ---- Auth -----------------------------------------
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      const res = await API.checkSession();
      setUser(res.ok ? res.data : null);
      setAuthLoading(false);
    })();
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await API.login(username, password);
    if (res.ok) setUser(res.data);
    return res;
  }, []);

  const logout = useCallback(async () => {
    await API.logout();
    setUser(null);
  }, []);

  // ---- Date range / currency / granularities -----------------------------------------
  const [period, setPeriodRaw] = useState('7d');
  const [range, setRange] = useState(() => computeRange('7d'));
  const [currency, setCurrency] = useState('USD');
  const [overviewGranularity, setOverviewGranularity] = useState('daily');
  const [revAnalyticsGranularity, setRevAnalyticsGranularity] = useState('daily');
  const [lastSync, setLastSync] = useState(null);
  const [connection, setConnection] = useState({ status: 'connecting', demo: API.isDemo() });

  const setPeriod = useCallback((p, customStart, customEnd) => {
    setPeriodRaw(p);
    if (p !== 'custom' || (customStart && customEnd)) {
      setRange(computeRange(p, customStart, customEnd));
      API.clearCache();
    }
  }, []);

  const refreshConnection = useCallback(async () => {
    setConnection((c) => ({ ...c, status: 'connecting' }));
    const res = await API.connectionStatus();
    if (res.ok && res.data.connected) {
      setConnection({ status: res.data.demo ? 'demo' : 'connected', demo: !!res.data.demo });
      const settingsRes = await API.storeSettings();
      if (settingsRes.ok && settingsRes.data.currency) setCurrency(settingsRes.data.currency);
    } else {
      setConnection({ status: 'disconnected', demo: API.isDemo(), error: res.error });
    }
    setLastSync(new Date());
  }, []);

  useEffect(() => {
    if (!authLoading && user) refreshConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const refreshAll = useCallback(() => {
    API.clearCache();
    return refreshConnection();
  }, [refreshConnection]);

  const value = {
    authLoading, user, login, logout,
    period, setPeriod, range,
    currency,
    overviewGranularity, setOverviewGranularity,
    revAnalyticsGranularity, setRevAnalyticsGranularity,
    lastSync, connection, refreshConnection, refreshAll,
    isDemo: API.isDemo(),
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  return useContext(DashboardContext);
}
