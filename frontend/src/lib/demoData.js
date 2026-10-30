/* ============================================================
   demo-data.js
   Generates deterministic SAMPLE data so the dashboard UI can be
   previewed before a real WooCommerce connection is configured.

   This module is ONLY consulted when window.DASHBOARD_CONFIG.demoMode
   is explicitly set to true (see app.js). It is never used as a
   silent fallback for a failed live request — a failed request always
   surfaces a real error state (see api.js / app.js renderError()).
   Every page that reads demo data shows the "Demo data" banner so
   nobody mistakes it for a live figure.
   ============================================================ */

  const PRODUCTS = [
    { id: 101, name: 'BPC-157 5mg', sku: 'XLP-BPC157-5', price: 59 },
    { id: 102, name: 'TB-500 5mg', sku: 'XLP-TB500-5', price: 69 },
    { id: 103, name: 'Semaglutide 5mg', sku: 'XLP-SEMA-5', price: 129 },
    { id: 104, name: 'CJC-1295 / Ipamorelin Blend', sku: 'XLP-CJC-IPA', price: 89 },
    { id: 105, name: 'NAD+ 500mg', sku: 'XLP-NAD-500', price: 99 },
    { id: 106, name: 'Tirzepatide 10mg', sku: 'XLP-TIRZ-10', price: 169 },
    { id: 107, name: 'GHK-Cu 50mg', sku: 'XLP-GHKCU-50', price: 54 },
    { id: 108, name: 'Bacteriostatic Water 30ml', sku: 'XLP-BACW-30', price: 15 },
    { id: 109, name: 'Melanotan II 10mg', sku: 'XLP-MT2-10', price: 49 },
    { id: 110, name: 'Insulin Syringes (100ct)', sku: 'XLP-SYR-100', price: 19 },
  ];
  const STATUSES = ['completed', 'processing', 'on-hold', 'pending', 'cancelled', 'refunded', 'failed'];
  const STATUS_WEIGHTS = [0.52, 0.18, 0.06, 0.05, 0.07, 0.09, 0.03];
  const PAYMENTS = ['Credit Card (Stripe)', 'PayPal', 'Crypto (Coinbase Commerce)', 'Bank Transfer'];
  const FIRST = ['James', 'Maria', 'Alex', 'Sarah', 'Michael', 'Linda', 'David', 'Priya', 'Chris', 'Jasmine', 'Omar', 'Elena'];
  const LAST = ['Carter', 'Nguyen', 'Johnson', 'Patel', 'Garcia', 'Kim', 'Brown', 'Singh', 'Walker', 'Rossi'];
  // A fixed pool of repeat "customers" (rather than one unique buyer per order)
  // so the Customers page can show believable multi-order, returning buyers.
  const CUSTOMER_POOL = Array.from({ length: 24 }, (_, i) => {
    const fn = FIRST[i % FIRST.length], ln = LAST[(i * 3) % LAST.length];
    return { name: `${fn} ${ln}`, email: `${fn.toLowerCase()}.${ln.toLowerCase()}@example.com` };
  });

  // Seeded PRNG so numbers stay stable across a session (mulberry32)
  function makeRng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashString(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; }
    return h;
  }

  // Orders are regenerated deterministically per date range (same range ->
  // identical order set every time, e.g. the Orders table and the order
  // detail modal always agree) and cached so repeat calls are cheap.
  const orderCacheByRange = new Map();
  let rng = makeRng(1); // reassigned per-range inside genOrders(); module-level so pick()/weightedStatus() can close over it
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const weightedStatus = () => {
    const r = rng(); let acc = 0;
    for (let i = 0; i < STATUSES.length; i++) { acc += STATUS_WEIGHTS[i]; if (r <= acc) return STATUSES[i]; }
    return STATUSES[0];
  };

  function daysBetween(range) {
    const start = new Date(range.start + 'T00:00:00');
    const end = new Date(range.end + 'T00:00:00');
    return Math.max(1, Math.round((end - start) / 86400000) + 1);
  }

  function genOrders(range) {
    const rangeKey = `${range.start || ''}|${range.end || ''}`;
    if (orderCacheByRange.has(rangeKey)) return orderCacheByRange.get(rangeKey);
    rng = makeRng(20261028 + hashString(rangeKey));

    const days = daysBetween(range);
    const count = Math.max(6, Math.round(days * 3.4));
    const orders = [];
    const start = new Date(range.start + 'T00:00:00');
    for (let i = 0; i < count; i++) {
      const dayOffset = Math.floor(rng() * days);
      const date = new Date(start.getTime() + dayOffset * 86400000);
      date.setHours(Math.floor(rng() * 23), Math.floor(rng() * 59));
      const lineCount = 1 + Math.floor(rng() * 3);
      const lines = [];
      let subtotal = 0;
      for (let l = 0; l < lineCount; l++) {
        const p = pick(PRODUCTS);
        const qty = 1 + Math.floor(rng() * 3);
        const lineTotal = p.price * qty;
        subtotal += lineTotal;
        lines.push({ product_id: p.id, name: p.name, sku: p.sku, qty, price: p.price, total: lineTotal });
      }
      const discount = rng() < 0.3 ? +(subtotal * 0.1).toFixed(2) : 0;
      const shipping = rng() < 0.85 ? 9.95 : 0;
      const taxable = subtotal - discount;
      const tax = +(taxable * 0.0).toFixed(2); // many peptide stores are tax-exempt; adjust per store
      const total = +(taxable + shipping + tax).toFixed(2);
      const status = weightedStatus();
      const refunded = status === 'refunded' ? +(total * (rng() < 0.4 ? 1 : 0.5)).toFixed(2) : 0;
      orders.push({
        id: 10450 + i,
        date: date.toISOString(),
        customer: pick(CUSTOMER_POOL),
        items: lines,
        subtotal: +subtotal.toFixed(2),
        discount, shipping, tax, total, refunded,
        payment_method: pick(PAYMENTS),
        status,
        notes: rng() < 0.2 ? 'Customer requested discreet packaging.' : '',
      });
    }
    orders.sort((a, b) => new Date(b.date) - new Date(a.date));
    orderCacheByRange.set(rangeKey, orders);
    return orders;
  }

  function isRevenueStatus(status) { return status === 'completed' || status === 'processing'; }

  export function respond(endpoint, params) {
    const range = { start: params.start, end: params.end };
    const orders = genOrders(range);

    switch (endpoint) {
      case 'connection-status':
        return ok({ connected: true, demo: true, store_url: 'https://xlpeptides.com', api_version: 'wc/v3' });

      case 'store-settings':
        return ok({ store_url: 'https://xlpeptides.com', currency: 'USD', currency_symbol: '$', timezone: 'America/New_York', date_format: 'MMM D, YYYY' });

      case 'sales-summary': {
        const revOrders = orders.filter(o => isRevenueStatus(o.status));
        const gross = sum(revOrders.map(o => o.subtotal + o.shipping + o.tax));
        const refunds = sum(orders.map(o => o.refunded));
        const discounts = sum(revOrders.map(o => o.discount));
        const net = gross - discounts - refunds;
        const productsSold = sum(revOrders.flatMap(o => o.items.map(i => i.qty)));
        const customers = new Set(revOrders.map(o => o.customer.email));
        return ok({
          gross_sales: gross, gross_sales_prev: gross * (0.85 + rng() * 0.25),
          net_sales: net, net_sales_prev: net * (0.85 + rng() * 0.25),
          total_orders: revOrders.length, total_orders_prev: Math.round(revOrders.length * (0.8 + rng() * 0.3)),
          aov: revOrders.length ? net / revOrders.length : 0, aov_prev: revOrders.length ? (net / revOrders.length) * (0.9 + rng() * 0.2) : 0,
          products_sold: productsSold, products_sold_prev: Math.round(productsSold * (0.85 + rng() * 0.25)),
          refunds_total: refunds, refunded_orders: orders.filter(o => o.status === 'refunded').length,
          refund_rate: revOrders.length ? orders.filter(o => o.status === 'refunded').length / orders.length : 0,
          customers_total: customers.size, new_customers: Math.round(customers.size * 0.55), returning_customers: Math.max(0, customers.size - Math.round(customers.size * 0.55)),
          avg_customer_spend: customers.size ? net / customers.size : 0,
          conversion_rate_available: false,
        });
      }

      case 'revenue-series': {
        const buckets = bucketOrders(orders, range, params.granularity || 'daily');
        return ok(buckets);
      }

      case 'order-status-breakdown': {
        const counts = {}; let totalVal = {};
        STATUSES.forEach(s => { counts[s] = 0; totalVal[s] = 0; });
        orders.forEach(o => { counts[o.status]++; totalVal[o.status] += o.total; });
        return ok(STATUSES.map(s => ({ status: s, count: counts[s], value: +totalVal[s].toFixed(2), pct: orders.length ? counts[s] / orders.length : 0 })));
      }

      case 'payment-methods': {
        const revOrders = orders.filter(o => isRevenueStatus(o.status));
        const grouped = {};
        revOrders.forEach(o => {
          grouped[o.payment_method] = grouped[o.payment_method] || { orders: 0, total: 0, net: 0 };
          grouped[o.payment_method].orders++;
          grouped[o.payment_method].total += o.total;
          grouped[o.payment_method].net += o.total - o.discount;
        });
        const totalAll = sum(Object.values(grouped).map(g => g.total));
        return ok(Object.entries(grouped).map(([method, g]) => ({
          method, orders: g.orders, total: +g.total.toFixed(2), net: +g.net.toFixed(2),
          aov: g.orders ? g.total / g.orders : 0, pct: totalAll ? g.total / totalAll : 0,
        })));
      }

      case 'orders': {
        let filtered = orders.slice();
        if (params.status) filtered = filtered.filter(o => o.status === params.status);
        if (params.payment) filtered = filtered.filter(o => o.payment_method === params.payment);
        if (params.search) {
          const q = params.search.toLowerCase();
          filtered = filtered.filter(o => String(o.id).includes(q) || o.customer.name.toLowerCase().includes(q) || o.customer.email.toLowerCase().includes(q) || o.items.some(i => i.name.toLowerCase().includes(q)));
        }
        if (params.min_total) filtered = filtered.filter(o => o.total >= parseFloat(params.min_total));
        if (params.max_total) filtered = filtered.filter(o => o.total <= parseFloat(params.max_total));
        const sortKey = params.sort || 'date';
        const dir = params.dir === 'asc' ? 1 : -1;
        filtered.sort((a, b) => {
          const va = sortableVal(a, sortKey), vb = sortableVal(b, sortKey);
          return va > vb ? dir : va < vb ? -dir : 0;
        });
        const perPage = parseInt(params.per_page) || 20;
        const page = parseInt(params.page) || 1;
        const start = (page - 1) * perPage;
        return ok({ rows: filtered.slice(start, start + perPage), total: filtered.length, page, per_page: perPage });
      }

      case 'order-detail': {
        const o = orders.find(x => String(x.id) === String(params.order_id)) || orders[0];
        return ok(o);
      }

      case 'products':
      case 'top-products': {
        const revOrders = orders.filter(o => isRevenueStatus(o.status));
        const agg = {};
        PRODUCTS.forEach(p => { agg[p.id] = { ...p, product_id: p.id, units: 0, gross: 0, refunds: 0 }; });
        revOrders.forEach(o => {
          o.items.forEach(i => { agg[i.product_id].units += i.qty; agg[i.product_id].gross += i.total; });
        });
        orders.filter(o => o.status === 'refunded').forEach(o => {
          o.items.forEach(i => { if (agg[i.product_id]) agg[i.product_id].refunds += i.total * 0.4; });
        });
        const totalGross = sum(Object.values(agg).map(p => p.gross)) || 1;
        let rows = Object.values(agg).map(p => ({
          ...p, net: +(p.gross - p.refunds).toFixed(2), gross: +p.gross.toFixed(2), refunds: +p.refunds.toFixed(2),
          aov: p.units ? p.gross / p.units : 0, share: p.gross / totalGross,
        }));
        if (endpoint === 'top-products') {
          rows.sort((a, b) => b.gross - a.gross);
          return ok(rows.slice(0, parseInt(params.limit) || 10));
        }
        if (params.search) rows = rows.filter(r => r.name.toLowerCase().includes(params.search.toLowerCase()) || r.sku.toLowerCase().includes(params.search.toLowerCase()));
        const sortMap = { revenue: 'gross', units: 'units', aov: 'aov', refunds: 'refunds', lowest: 'gross' };
        const key = sortMap[params.sort] || 'gross';
        rows.sort((a, b) => params.sort === 'lowest' ? a[key] - b[key] : b[key] - a[key]);
        const perPage = parseInt(params.per_page) || 20;
        const page = parseInt(params.page) || 1;
        const start = (page - 1) * perPage;
        return ok({ rows: rows.slice(start, start + perPage), total: rows.length, page, per_page: perPage });
      }

      case 'customer-summary': {
        const revOrders = orders.filter(o => isRevenueStatus(o.status));
        const byEmail = groupCustomers(revOrders);
        const list = Object.values(byEmail);
        return ok({
          total_customers: list.length,
          new_customers: Math.round(list.length * 0.55),
          returning_customers: list.filter(c => c.orders > 1).length,
          avg_ltv: list.length ? sum(list.map(c => c.ltv)) / list.length : 0,
        });
      }

      case 'customers': {
        const revOrders = orders.filter(o => isRevenueStatus(o.status));
        const byEmail = groupCustomers(revOrders);
        let rows = Object.values(byEmail);
        if (params.search) rows = rows.filter(c => c.name.toLowerCase().includes(params.search.toLowerCase()) || c.email.toLowerCase().includes(params.search.toLowerCase()));
        const sortMap = { ltv: 'ltv', orders: 'orders', recent: 'last_purchase', aov: 'aov' };
        const key = sortMap[params.sort] || 'ltv';
        rows.sort((a, b) => key === 'last_purchase' ? new Date(b[key]) - new Date(a[key]) : b[key] - a[key]);
        const perPage = parseInt(params.per_page) || 20;
        const page = parseInt(params.page) || 1;
        const start = (page - 1) * perPage;
        return ok({ rows: rows.slice(start, start + perPage), total: rows.length, page, per_page: perPage });
      }

      case 'refund-summary': {
        const refundOrders = orders.filter(o => o.refunded > 0);
        const revOrders = orders.filter(o => isRevenueStatus(o.status));
        const totalRefunded = sum(refundOrders.map(o => o.refunded));
        const totalDiscounts = sum(revOrders.map(o => o.discount));
        const grossBefore = sum(revOrders.map(o => o.subtotal));
        return ok({
          total_refunded: totalRefunded, refunded_orders: refundOrders.length,
          refund_rate: orders.length ? refundOrders.length / orders.length : 0,
          total_discounts: totalDiscounts, avg_discount: revOrders.length ? totalDiscounts / revOrders.length : 0,
          sales_before_discount: grossBefore, sales_after_discount: grossBefore - totalDiscounts,
        });
      }

      case 'refund-trend': {
        const refundOrders = orders.filter(o => o.refunded > 0);
        return ok(bucketOrders(refundOrders, range, params.granularity || 'daily', true));
      }

      case 'refunded-products': {
        const agg = {};
        orders.filter(o => o.refunded > 0).forEach(o => {
          o.items.forEach(i => {
            agg[i.name] = (agg[i.name] || 0) + i.total * 0.4;
          });
        });
        const rows = Object.entries(agg).map(([name, amount]) => ({ name, amount: +amount.toFixed(2) }))
          .sort((a, b) => b.amount - a.amount).slice(0, parseInt(params.limit) || 8);
        return ok(rows);
      }

      case 'export':
        return ok({ note: 'Demo mode: CSV is generated client-side from the data above.' });

      default:
        return { ok: false, error: { type: 'api', message: `Unknown demo endpoint: ${endpoint}` } };
    }
  }

  function sortableVal(o, key) {
    switch (key) {
      case 'id': return o.id;
      case 'date': return new Date(o.date).getTime();
      case 'customer': return o.customer.name;
      case 'items': return o.items.length;
      case 'total': return o.total;
      case 'refunded': return o.refunded;
      case 'payment': return o.payment_method;
      case 'status': return o.status;
      default: return o.id;
    }
  }

  function groupCustomers(revOrders) {
    const byEmail = {};
    revOrders.forEach(o => {
      byEmail[o.customer.email] = byEmail[o.customer.email] || { name: o.customer.name, email: o.customer.email, orders: 0, ltv: 0, last_purchase: o.date };
      const c = byEmail[o.customer.email];
      c.orders++; c.ltv += o.total;
      if (new Date(o.date) > new Date(c.last_purchase)) c.last_purchase = o.date;
    });
    Object.values(byEmail).forEach(c => { c.aov = c.orders ? c.ltv / c.orders : 0; c.ltv = +c.ltv.toFixed(2); });
    return byEmail;
  }

  function bucketOrders(orders, range, granularity, sumRefunded) {
    const start = new Date(range.start + 'T00:00:00');
    const end = new Date(range.end + 'T00:00:00');
    const labels = []; const gross = []; const net = []; const orderCounts = [];
    const fmt = (d) => d.toISOString().slice(0, 10);

    let step = 86400000, labelFn = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (granularity === 'weekly') { step = 7 * 86400000; labelFn = (d) => 'Wk of ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
    if (granularity === 'monthly') { labelFn = (d) => d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }); }

    if (granularity === 'monthly') {
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cursor <= end) {
        const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
        const inMonth = orders.filter(o => { const d = new Date(o.date); return d >= cursor && d <= monthEnd; });
        labels.push(labelFn(cursor));
        gross.push(+sum(inMonth.map(o => sumRefunded ? o.refunded : o.subtotal + o.shipping + o.tax)).toFixed(2));
        net.push(+sum(inMonth.map(o => sumRefunded ? o.refunded : o.subtotal + o.shipping + o.tax - o.discount)).toFixed(2));
        orderCounts.push(inMonth.length);
        cursor.setMonth(cursor.getMonth() + 1);
      }
    } else {
      for (let cursor = new Date(start); cursor <= end; cursor = new Date(cursor.getTime() + step)) {
        const bucketEnd = new Date(Math.min(cursor.getTime() + step, end.getTime() + 86400000));
        const inBucket = orders.filter(o => { const d = new Date(o.date); return d >= cursor && d < bucketEnd; });
        labels.push(labelFn(cursor));
        gross.push(+sum(inBucket.map(o => sumRefunded ? o.refunded : o.subtotal + o.shipping + o.tax)).toFixed(2));
        net.push(+sum(inBucket.map(o => sumRefunded ? o.refunded : o.subtotal + o.shipping + o.tax - o.discount)).toFixed(2));
        orderCounts.push(inBucket.length);
      }
    }
    return { labels, gross, net, orders: orderCounts };
  }

  function sum(arr) { return arr.reduce((a, b) => a + b, 0); }
  function ok(data) { return Promise.resolve({ ok: true, data, demo: true }); }

