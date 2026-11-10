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

  // ---- Marketing & Ads demo data -----------------------------------------
  const GADS_CAMPAIGNS = [
    { id: '7001001', name: 'Brand_Search', type: 'Search', baseCost: 18, cpc: 0.55, ctr: 0.055, convRate: 0.09 },
    { id: '7001002', name: 'Generic_Peptides_Search', type: 'Search', baseCost: 38, cpc: 1.05, ctr: 0.025, convRate: 0.035 },
    { id: '7001003', name: 'Shopping_All_Products', type: 'Shopping', baseCost: 24, cpc: 0.65, ctr: 0.018, convRate: 0.028 },
    { id: '7001004', name: 'Remarketing_Display', type: 'Display', baseCost: 9, cpc: 0.35, ctr: 0.004, convRate: 0.015 },
  ];
  // Weighted distribution of Channel across demo orders, per the brief's
  // category list. Google Ads orders pick a campaign name from the list
  // above so the demo Campaign Performance table has real matches.
  const CHANNEL_WEIGHTS = [
    ['Google Ads', 0.17], ['Google Organic', 0.20], ['Other Organic Search', 0.06],
    ['Paid Social', 0.10], ['Organic Social', 0.05], ['Email', 0.08],
    ['AI Assistants', 0.03], ['Referral', 0.07], ['Direct', 0.16], ['Unknown', 0.08],
  ];
  function pickChannel() {
    const r = rng(); let acc = 0;
    for (const [ch, w] of CHANNEL_WEIGHTS) { acc += w; if (r <= acc) return ch; }
    return CHANNEL_WEIGHTS[CHANNEL_WEIGHTS.length - 1][0];
  }
  function genAttribution(channel) {
    const blank = { sourceType: '', source: '', medium: '', campaign: '', referrer: '', deviceType: pick(['desktop', 'mobile', 'tablet']) };
    switch (channel) {
      case 'Google Ads': {
        const camp = pick(GADS_CAMPAIGNS);
        return { ...blank, sourceType: 'utm', source: 'google', medium: 'cpc', campaign: camp.name };
      }
      case 'Google Organic':
        return { ...blank, sourceType: 'organic', source: 'google' };
      case 'Other Organic Search':
        return { ...blank, sourceType: 'organic', source: pick(['bing', 'duckduckgo']) };
      case 'Paid Social':
        return { ...blank, sourceType: 'utm', source: pick(['facebook', 'instagram', 'tiktok']), medium: 'cpc' };
      case 'Organic Social':
        return { ...blank, sourceType: 'referral', source: pick(['instagram', 'youtube', 'reddit']) };
      case 'Email':
        return { ...blank, sourceType: 'utm', medium: 'email', campaign: pick(['Monthly_Newsletter', 'Abandoned_Cart', 'Winback_Offer']) };
      case 'AI Assistants':
        return { ...blank, sourceType: 'referral', referrer: pick(['https://chatgpt.com/share/xyz', 'https://www.perplexity.ai/search/abc']) };
      case 'Referral':
        return { ...blank, sourceType: 'referral', referrer: pick(['https://partnerblog.example.com/review', 'https://healthforum.example.net/thread']) };
      case 'Direct':
        return { ...blank, sourceType: 'typein' };
      default:
        return blank; // Unknown — no attribution recorded at all
    }
  }

  const gadsCacheByRange = new Map();
  function genGoogleAdsData(range) {
    const rangeKey = `gads|${range.start || ''}|${range.end || ''}`;
    if (gadsCacheByRange.has(rangeKey)) return gadsCacheByRange.get(rangeKey);
    const days = daysBetween(range);
    const start = new Date(range.start + 'T00:00:00');
    const rows = [];
    for (let d = 0; d < days; d++) {
      const date = new Date(start.getTime() + d * 86400000).toISOString().slice(0, 10);
      for (const c of GADS_CAMPAIGNS) {
        const cost = +(c.baseCost * (0.7 + rng() * 0.6)).toFixed(2);
        const clicks = Math.max(1, Math.round(cost / c.cpc));
        const impressions = Math.max(clicks, Math.round(clicks / c.ctr));
        const conversions = +(clicks * c.convRate * (0.7 + rng() * 0.6)).toFixed(2);
        // Google's own reported conversion value usually runs a bit ahead of
        // what the store can attribute last-click — mirrors the brief's
        // "Google usually claims more sales" note (see §4).
        const conversion_value = +(conversions * 95 * (1.1 + rng() * 0.3)).toFixed(2);
        rows.push({ date, campaign_id: c.id, campaign_name: c.name, campaign_type: c.type, cost, clicks, impressions, conversions, conversion_value });
      }
    }
    gadsCacheByRange.set(rangeKey, rows);
    return rows;
  }
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
      const channel = pickChannel();
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
        channel,
        attribution: genAttribution(channel),
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

      case 'marketing-summary': {
        const adsRows = genGoogleAdsData(range);
        const adSpend = sum(adsRows.map((r) => r.cost));
        const googleConvValue = sum(adsRows.map((r) => r.conversion_value));
        const { net: gAdsRevenue } = googleAdsChannelRevenue(orders);
        const totalRevenue = totalStoreNetSales(orders);

        const prevRange = previousEqualRange(range);
        const prevOrders = genOrders(prevRange);
        const prevAdsRows = genGoogleAdsData(prevRange);
        const prevAdSpend = sum(prevAdsRows.map((r) => r.cost));
        const { net: prevGAdsRevenue } = googleAdsChannelRevenue(prevOrders);
        const prevTotalRevenue = totalStoreNetSales(prevOrders);

        return ok({
          ads_available: true,
          ad_spend: round2(adSpend), ad_spend_prev: round2(prevAdSpend),
          google_ads_revenue_store: round2(gAdsRevenue), google_ads_revenue_store_prev: round2(prevGAdsRevenue),
          acos_store: safeDiv(adSpend, gAdsRevenue, round4), acos_store_prev: safeDiv(prevAdSpend, prevGAdsRevenue, round4),
          acos_google: safeDiv(adSpend, googleConvValue, round4),
          roas: safeDiv(gAdsRevenue, adSpend, round4), roas_prev: safeDiv(prevGAdsRevenue, prevAdSpend, round4),
          tacos: safeDiv(adSpend, totalRevenue, round4),
          total_revenue: round2(totalRevenue), total_revenue_prev: round2(prevTotalRevenue),
          google_conversion_value: round2(googleConvValue),
          gap: round2(googleConvValue - gAdsRevenue),
        });
      }

      case 'sales-by-channel': {
        const revOrders = orders.filter((o) => isRevenueStatus(o.status));
        const byChannel = {};
        const ensure = (ch) => (byChannel[ch] ??= { channel: ch, orders: 0, gross: 0, discount: 0, refunds: 0 });
        revOrders.forEach((o) => { const r = ensure(o.channel); r.orders++; r.gross += o.subtotal + o.shipping + o.tax; r.discount += o.discount; });
        orders.forEach((o) => { if (o.refunded > 0) ensure(o.channel).refunds += o.refunded; });
        const rows = Object.values(byChannel).map((r) => ({
          channel: r.channel, orders: r.orders, gross: round2(r.gross),
          net: round2(r.gross - r.discount - r.refunds),
          aov: r.orders ? round2((r.gross - r.discount - r.refunds) / r.orders) : 0,
        }));
        const totalGross = sum(rows.map((r) => r.gross)) || 1;
        rows.forEach((r) => { r.share = round4(r.gross / totalGross); });
        const order = ['Google Ads', 'Google Organic', 'Other Organic Search', 'Paid Social', 'Organic Social', 'Email', 'AI Assistants', 'Referral', 'Direct', 'Mobile App', 'Admin / Manual', 'Unknown'];
        rows.sort((a, b) => order.indexOf(a.channel) - order.indexOf(b.channel));
        return ok(rows);
      }

      case 'attribution-detail': {
        const revOrders = orders.filter((o) => isRevenueStatus(o.status));
        const groups = {};
        revOrders.forEach((o) => {
          const a = o.attribution;
          const key = [a.sourceType || '—', a.source || '—', a.medium || '—', a.campaign || '—', a.referrer || '—'].join('||');
          groups[key] ??= { source_type: a.sourceType || '—', source: a.source || '—', medium: a.medium || '—', campaign: a.campaign || '—', referrer: a.referrer || '—', channel: o.channel, orders: 0, revenue: 0 };
          groups[key].orders++; groups[key].revenue += o.total;
        });
        let rows = Object.values(groups).map((g) => ({ ...g, revenue: round2(g.revenue) }));
        if (params.search) {
          const q = params.search.toLowerCase();
          rows = rows.filter((r) => [r.source, r.medium, r.campaign, r.referrer, r.channel].some((v) => v.toLowerCase().includes(q)));
        }
        if (params.channel) rows = rows.filter((r) => r.channel === params.channel);
        rows.sort((a, b) => b.orders - a.orders);
        const perPage = parseInt(params.per_page) || 20;
        const page = parseInt(params.page) || 1;
        const start = (page - 1) * perPage;
        const unknownOrders = revOrders.filter((o) => o.channel === 'Unknown').length;
        return ok({
          rows: rows.slice(start, start + perPage), total: rows.length, page, per_page: perPage,
          pct_unknown: revOrders.length ? round4(unknownOrders / revOrders.length) : 0,
        });
      }

      case 'ads-trend': {
        const adsRows = genGoogleAdsData(range);
        const gAdsOrders = orders.filter((o) => isRevenueStatus(o.status) && o.channel === 'Google Ads');
        const granularity = params.granularity || 'daily';
        const labels = [], spend = [], revenue = [], acos = [];
        let cursor = new Date(range.start + 'T00:00:00');
        const end = new Date(range.end + 'T00:00:00');
        const fmt = (d) => {
          if (granularity === 'monthly') return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
          if (granularity === 'weekly') return 'Wk of ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        };
        while (cursor <= end) {
          let bucketStart, bucketEnd;
          if (granularity === 'monthly') {
            bucketStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
            bucketEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
            cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
          } else if (granularity === 'weekly') {
            bucketStart = new Date(cursor);
            bucketEnd = new Date(cursor.getTime() + 6 * 86400000);
            cursor = new Date(cursor.getTime() + 7 * 86400000);
          } else {
            bucketStart = new Date(cursor);
            bucketEnd = new Date(cursor);
            cursor = new Date(cursor.getTime() + 86400000);
          }
          const bucketSpend = sum(adsRows.filter((r) => { const d = new Date(r.date); return d >= bucketStart && d <= bucketEnd; }).map((r) => r.cost));
          const bucketRevenue = sum(gAdsOrders.filter((o) => { const d = new Date(o.date.slice(0, 10)); return d >= bucketStart && d <= bucketEnd; }).map((o) => o.subtotal + o.shipping + o.tax - o.discount - o.refunded));
          labels.push(fmt(bucketStart));
          spend.push(round2(bucketSpend));
          revenue.push(round2(bucketRevenue));
          acos.push(safeDiv(bucketSpend, bucketRevenue, round4));
        }
        return ok({ available: true, labels, spend, revenue, acos });
      }

      case 'campaign-performance': {
        const adsRows = genGoogleAdsData(range);
        const byCampaign = {};
        adsRows.forEach((r) => {
          byCampaign[r.campaign_id] ??= { campaign_id: r.campaign_id, campaign_name: r.campaign_name, campaign_type: r.campaign_type, cost: 0, clicks: 0, impressions: 0, conversions: 0, conversion_value: 0 };
          const c = byCampaign[r.campaign_id];
          c.cost += r.cost; c.clicks += r.clicks; c.impressions += r.impressions; c.conversions += r.conversions; c.conversion_value += r.conversion_value;
        });
        const gAdsAllOrders = orders.filter((o) => o.channel === 'Google Ads');
        const gAdsRevOrders = gAdsAllOrders.filter((o) => isRevenueStatus(o.status));
        let rows = Object.values(byCampaign).map((c) => {
          const matchedRevenue = gAdsRevOrders.filter((o) => o.attribution.campaign === c.campaign_name);
          const matchedAny = gAdsAllOrders.filter((o) => o.attribution.campaign === c.campaign_name);
          const gross = sum(matchedRevenue.map((o) => o.subtotal + o.shipping + o.tax - o.discount));
          const refunds = sum(matchedAny.map((o) => o.refunded));
          const storeRevenue = gross - refunds;
          const storeOrders = matchedRevenue.length;
          return {
            campaign_id: c.campaign_id, campaign_name: c.campaign_name, campaign_type: c.campaign_type,
            cost: round2(c.cost), clicks: c.clicks, impressions: c.impressions,
            ctr: c.impressions ? round4(c.clicks / c.impressions) : null,
            cpc: c.clicks ? round2(c.cost / c.clicks) : null,
            store_orders: storeOrders, store_revenue: round2(storeRevenue),
            acos_store: storeOrders ? safeDiv(c.cost, storeRevenue, round4) : null,
            google_conversion_value: round2(c.conversion_value),
            acos_google: safeDiv(c.cost, c.conversion_value, round4),
            roas: storeOrders ? safeDiv(storeRevenue, c.cost, round4) : null,
            matched: storeOrders > 0,
          };
        });
        if (params.search) { const q = params.search.toLowerCase(); rows = rows.filter((r) => r.campaign_name.toLowerCase().includes(q)); }
        const sortKey = params.sort || 'cost';
        rows.sort((a, b) => (b[sortKey] ?? -Infinity) - (a[sortKey] ?? -Infinity));
        const perPage = parseInt(params.per_page) || 20;
        const page = parseInt(params.page) || 1;
        const start = (page - 1) * perPage;
        return ok({ available: true, rows: rows.slice(start, start + perPage), total: rows.length, page, per_page: perPage });
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
  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function round4(n) { return Math.round((n + Number.EPSILON) * 10000) / 10000; }
  function safeDiv(numerator, denominator, roundFn) {
    if (!denominator || numerator == null) return null;
    return roundFn(numerator / denominator);
  }
  function googleAdsChannelRevenue(orders) {
    const revOrders = orders.filter((o) => isRevenueStatus(o.status) && o.channel === 'Google Ads');
    const gross = sum(revOrders.map((o) => o.subtotal + o.shipping + o.tax));
    const discount = sum(revOrders.map((o) => o.discount));
    const refunds = sum(orders.filter((o) => o.channel === 'Google Ads').map((o) => o.refunded));
    return { net: gross - discount - refunds, orders: revOrders.length };
  }
  function totalStoreNetSales(orders) {
    const revOrders = orders.filter((o) => isRevenueStatus(o.status));
    const gross = sum(revOrders.map((o) => o.subtotal + o.shipping + o.tax));
    const discount = sum(revOrders.map((o) => o.discount));
    const refunds = sum(orders.map((o) => o.refunded));
    return gross - discount - refunds;
  }
  function previousEqualRange(range) {
    const start = new Date(range.start);
    const end = new Date(range.end);
    const days = Math.round((end - start) / 86400000) + 1;
    const prevEnd = new Date(start.getTime() - 86400000);
    const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000);
    const fmt = (d) => d.toISOString().slice(0, 10);
    return { start: fmt(prevStart), end: fmt(prevEnd) };
  }

