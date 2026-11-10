/* ============================================================
   api.js
   Client for the Express backend (deployed separately on Oracle
   Cloud). Falls back to generated demo data when VITE_DEMO_MODE
   is "true" — never as a silent fallback for a failed real
   request, only as an explicit, clearly-labeled preview mode
   (see lib/demoData.js header and the banner in App.jsx).
   ============================================================ */

import * as DemoData from './demoData.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
const DEMO_MODE = String(import.meta.env.VITE_DEMO_MODE || 'true') === 'true';

const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
const inflight = new Map();

function isDemo() { return DEMO_MODE; }

function cacheKey(endpoint, params) {
  return endpoint + '?' + new URLSearchParams(params).toString();
}

async function request(endpoint, params = {}, { useCache = true, timeoutMs = 15000, auth } = {}) {
  if (DEMO_MODE) {
    return DemoData.respond(endpoint, params);
  }

  const key = cacheKey(endpoint, params);
  if (useCache && cache.has(key)) {
    const entry = cache.get(key);
    if (Date.now() - entry.ts < CACHE_TTL_MS) return { ok: true, data: entry.data, fromCache: true };
  }
  if (inflight.has(key)) return inflight.get(key);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const qs = new URLSearchParams(params).toString();

  const promise = fetch(`${API_BASE}/api/${endpoint}${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    credentials: 'include', // sends the httpOnly session cookie set by /api/auth/login
    signal: controller.signal,
  })
    .then(async (res) => {
      clearTimeout(timeout);
      let body;
      try { body = await res.json(); } catch { body = null; }

      if (res.status === 401) return { ok: false, error: { type: 'auth', message: 'Your session has expired. Please sign in again.' }, unauthorized: true };
      if (res.status === 429) return { ok: false, error: { type: 'rate_limit', message: 'Rate limit reached. Please wait a moment and retry.' } };
      if (!res.ok || !body || body.success === false) {
        const msg = (body && body.message) ? body.message : `Request failed (HTTP ${res.status}).`;
        return { ok: false, error: { type: 'api', message: msg } };
      }
      if (useCache) cache.set(key, { data: body.data, ts: Date.now() });
      return { ok: true, data: body.data };
    })
    .catch((err) => {
      clearTimeout(timeout);
      if (err.name === 'AbortError') return { ok: false, error: { type: 'timeout', message: 'The request to the server timed out.' } };
      return { ok: false, error: { type: 'network', message: 'Could not reach the backend server. Check your connection and try again.' } };
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return promise;
}

function clearCache() { cache.clear(); }

// ---- Auth -----------------------------------------
async function login(username, password) {
  if (DEMO_MODE) return { ok: true, data: { username } }; // demo mode skips real auth entirely
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) return { ok: false, error: { message: body?.message || 'Invalid credentials.' } };
    return { ok: true, data: body.data };
  } catch {
    return { ok: false, error: { message: 'Could not reach the backend server.' } };
  }
}

async function logout() {
  if (DEMO_MODE) return { ok: true };
  try {
    await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch { /* ignore */ }
  return { ok: true };
}

async function checkSession() {
  if (DEMO_MODE) return { ok: true, data: { username: 'demo' } };
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' });
    if (!res.ok) return { ok: false };
    const body = await res.json();
    return { ok: true, data: body.data };
  } catch {
    return { ok: false };
  }
}

// ---- Public endpoint wrappers -----------------------------------------
export const API = {
  isDemo,
  clearCache,
  login,
  logout,
  checkSession,

  connectionStatus: () => request('connection-status', {}, { useCache: false }),
  storeSettings: () => request('store-settings'),
  salesSummary: (range) => request('sales-summary', range),
  revenueSeries: (range, granularity) => request('revenue-series', { ...range, granularity }),
  orderStatusBreakdown: (range) => request('order-status-breakdown', range),
  paymentMethodBreakdown: (range) => request('payment-methods', range),

  orders: (range, { page = 1, perPage = 20, status = '', payment = '', search = '', minTotal = '', maxTotal = '', sort = 'date', dir = 'desc' } = {}) =>
    request('orders', { ...range, page, per_page: perPage, status, payment, search, min_total: minTotal, max_total: maxTotal, sort, dir }, { useCache: false }),

  orderDetail: (orderId, range = {}) => request('order-detail', { ...range, order_id: orderId }, { useCache: false }),

  products: (range, { page = 1, perPage = 20, search = '', sort = 'revenue' } = {}) =>
    request('products', { ...range, page, per_page: perPage, search, sort }),

  topProducts: (range, limit = 10) => request('top-products', { ...range, limit }),

  customers: (range, { page = 1, perPage = 20, search = '', sort = 'ltv' } = {}) =>
    request('customers', { ...range, page, per_page: perPage, search, sort }),

  customerSummary: (range) => request('customer-summary', range),
  refundSummary: (range) => request('refund-summary', range),
  refundTrend: (range, granularity) => request('refund-trend', { ...range, granularity }),
  refundedProducts: (range, limit = 8) => request('refunded-products', { ...range, limit }),

  // ---- Marketing & Ads -----------------------------------------
  marketingSummary: (range) => request('marketing-summary', range),
  salesByChannel: (range) => request('sales-by-channel', range),
  attributionDetail: (range, { page = 1, perPage = 20, search = '', channel = '' } = {}) =>
    request('attribution-detail', { ...range, page, per_page: perPage, search, channel }),
  adsTrend: (range, granularity) => request('ads-trend', { ...range, granularity }),
  campaignPerformance: (range, { page = 1, perPage = 20, search = '', sort = 'cost' } = {}) =>
    request('campaign-performance', { ...range, page, per_page: perPage, search, sort }),
};
