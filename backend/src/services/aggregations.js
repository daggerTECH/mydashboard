/**
 * aggregations.js
 *
 * ===========================================================================
 * METRIC DEFINITIONS (kept consistent with the project spec)
 * ===========================================================================
 * Revenue-recognized order statuses: "completed" and "processing" only.
 *
 *   Item sales          = sum of line_item subtotals (before order-level discount)
 *   Gross sales         = Item sales + shipping_total + total_tax (revenue-recognized orders only)
 *   Discounts           = order.discount_total
 *   Refunds             = sum(abs(refund.total)), grouped by the ORIGINAL ORDER
 *                         DATE, not the refund date
 *   Net sales           = Gross sales − Discounts − Refunds
 *   Average order value = Net sales ÷ eligible (revenue-recognized) orders
 *   Products sold       = sum of line-item quantities, revenue-recognized orders only
 *
 * Partial/multiple refunds on one order are summed once each, never double
 * counted. Product-level refunds are attributed proportionally across an
 * order's line items by each item's share of the order subtotal.
 * ===========================================================================
 */

import { wooClient } from './wooClient.js';
import { getSessions } from './ga4Client.js';
import { classifyChannel } from './channelMapping.js';

/**
 * Pulls WooCommerce's built-in Order Attribution fields out of an order's
 * meta_data array (present regardless of whether the store uses HPOS or
 * legacy postmeta storage — the REST API normalizes both). Orders placed
 * before Order Attribution was enabled (WC < 8.5) simply won't have these
 * keys, and come back as "Unknown" — not an error.
 */
function extractAttribution(metaData) {
  const map = {};
  for (const m of metaData || []) {
    if (typeof m.key === 'string' && m.key.startsWith('_wc_order_attribution_')) {
      map[m.key.replace('_wc_order_attribution_', '')] = m.value;
    }
  }
  const lower = (v) => (v == null ? '' : String(v).toLowerCase().trim());
  return {
    sourceType: lower(map.source_type),
    source: lower(map.utm_source),
    medium: lower(map.utm_medium),
    campaign: map.utm_campaign || '', // kept original case — used for campaign-name matching against Google Ads
    term: map.utm_term || '',
    content: map.utm_content || '',
    referrer: lower(map.referrer),
    deviceType: lower(map.device_type),
    sessionPages: map.session_pages || '',
    sessionCount: map.session_count || '',
  };
}

export function isRevenueStatus(status) {
  return status === 'completed' || status === 'processing';
}

export function normalizeOrder(o) {
  const items = (o.line_items || []).map((li) => ({
    product_id: li.product_id || 0,
    name: li.name || 'Unknown product',
    sku: li.sku || '',
    qty: Number(li.quantity || 0),
    price: li.quantity ? Number(li.total) / Math.max(1, Number(li.quantity)) : 0,
    total: Number(li.total || 0),
  }));

  const refunded = (o.refunds || []).reduce((sum, r) => sum + Math.abs(Number(r.total || 0)), 0);
  const attribution = extractAttribution(o.meta_data);

  return {
    id: o.id,
    date: o.date_created || null,
    customer: {
      name: `${o.billing?.first_name || ''} ${o.billing?.last_name || ''}`.trim() || 'Guest',
      email: o.billing?.email || '',
    },
    items,
    subtotal: items.reduce((s, i) => s + i.total, 0),
    discount: Number(o.discount_total || 0),
    shipping: Number(o.shipping_total || 0),
    tax: Number(o.total_tax || 0),
    total: Number(o.total || 0),
    refunded,
    payment_method: o.payment_method_title || 'Unknown',
    status: String(o.status || 'pending').replace(/^wc-/, ''),
    notes: o.customer_note || '',
    attribution,
    channel: classifyChannel(attribution),
  };
}

export async function fetchOrdersInRange(range) {
  const after = `${range.start}T00:00:00`;
  const before = `${range.end}T23:59:59`;
  const raw = await wooClient.getAllPages('orders', {
    after,
    before,
    status: 'any',
    orderby: 'date',
    order: 'desc',
    _fields: 'id,date_created,status,total,discount_total,shipping_total,total_tax,line_items,billing,payment_method_title,refunds,customer_note,meta_data',
  });
  return raw.map(normalizeOrder);
}

export function previousEqualRange(range) {
  const start = new Date(range.start);
  const end = new Date(range.end);
  const days = Math.round((end - start) / 86400000) + 1;
  const prevEnd = new Date(start.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86400000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { start: fmt(prevStart), end: fmt(prevEnd) };
}

export async function salesSummary(range) {
  const orders = await fetchOrdersInRange(range);
  const revOrders = orders.filter((o) => isRevenueStatus(o.status));

  const gross = sum(revOrders.map((o) => o.subtotal + o.shipping + o.tax));
  const discounts = sum(revOrders.map((o) => o.discount));
  const refunds = sum(orders.map((o) => o.refunded));
  const net = gross - discounts - refunds;
  const productsSold = sum(revOrders.map((o) => sum(o.items.map((i) => i.qty))));
  const refundedOrders = orders.filter((o) => o.refunded > 0).length;
  const emails = new Set(revOrders.map((o) => o.customer.email));

  const prevRange = previousEqualRange(range);
  const prevOrders = await fetchOrdersInRange(prevRange);
  const prevRev = prevOrders.filter((o) => isRevenueStatus(o.status));
  const prevGross = sum(prevRev.map((o) => o.subtotal + o.shipping + o.tax));
  const prevNet = prevGross - sum(prevRev.map((o) => o.discount)) - sum(prevOrders.map((o) => o.refunded));

  // Conversion rate = WooCommerce orders ÷ GA4 sessions for the same period.
  // Never estimated from order counts alone — only computed when a real GA4
  // session count comes back (see ga4Client.js for the full fallback logic).
  const sessions = await getSessions(range);
  const conversionAvailable = sessions != null && sessions > 0;
  const conversionRate = conversionAvailable ? round4(revOrders.length / sessions) : null;

  return {
    gross_sales: round2(gross), gross_sales_prev: round2(prevGross),
    net_sales: round2(net), net_sales_prev: round2(prevNet),
    total_orders: revOrders.length, total_orders_prev: prevRev.length,
    aov: revOrders.length ? round2(net / revOrders.length) : 0,
    aov_prev: prevRev.length ? round2(prevNet / prevRev.length) : 0,
    products_sold: productsSold,
    products_sold_prev: sum(prevRev.map((o) => sum(o.items.map((i) => i.qty)))),
    refunds_total: round2(refunds),
    refunded_orders: refundedOrders,
    refund_rate: orders.length ? round4(refundedOrders / orders.length) : 0,
    customers_total: emails.size,
    new_customers: null, // see customerSummary() for the full lookback calculation
    returning_customers: null,
    avg_customer_spend: emails.size ? round2(net / emails.size) : 0,
    conversion_rate: conversionRate,
    conversion_rate_available: conversionAvailable,
    sessions: sessions ?? null,
  };
}

export function bucketOrders(orders, range, granularity) {
  const labels = []; const gross = []; const net = []; const counts = [];
  let cursor = new Date(range.start);
  const end = new Date(range.end);

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
    const inBucket = orders.filter((o) => {
      const d = new Date(o.date.slice(0, 10));
      return d >= bucketStart && d <= bucketEnd;
    });
    labels.push(fmt(bucketStart));
    const g = sum(inBucket.map((o) => o.subtotal + o.shipping + o.tax));
    const n = g - sum(inBucket.map((o) => o.discount)) - sum(inBucket.map((o) => o.refunded));
    gross.push(round2(g));
    net.push(round2(n));
    counts.push(inBucket.length);
  }
  return { labels, gross, net, orders: counts };
}

export async function revenueSeries(range, granularity) {
  const orders = (await fetchOrdersInRange(range)).filter((o) => isRevenueStatus(o.status));
  return bucketOrders(orders, range, granularity);
}

export async function orderStatusBreakdown(range) {
  const orders = await fetchOrdersInRange(range);
  const statuses = ['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed'];
  const total = orders.length || 1;
  return statuses.map((s) => {
    const inStatus = orders.filter((o) => o.status === s);
    return { status: s, count: inStatus.length, value: round2(sum(inStatus.map((o) => o.total))), pct: round4(inStatus.length / total) };
  });
}

export async function paymentMethodBreakdown(range) {
  const orders = (await fetchOrdersInRange(range)).filter((o) => isRevenueStatus(o.status));
  const grouped = {};
  for (const o of orders) {
    grouped[o.payment_method] ??= { orders: 0, total: 0, net: 0 };
    grouped[o.payment_method].orders++;
    grouped[o.payment_method].total += o.total;
    grouped[o.payment_method].net += o.total - o.discount;
  }
  const totalAll = sum(Object.values(grouped).map((g) => g.total)) || 1;
  return Object.entries(grouped)
    .map(([method, g]) => ({
      method, orders: g.orders, total: round2(g.total), net: round2(g.net),
      aov: g.orders ? round2(g.total / g.orders) : 0, pct: round4(g.total / totalAll),
    }))
    .sort((a, b) => b.total - a.total);
}

export async function listOrders(range, opts) {
  let orders = await fetchOrdersInRange(range);

  if (opts.status) orders = orders.filter((o) => o.status === opts.status);
  if (opts.payment) orders = orders.filter((o) => o.payment_method === opts.payment);
  if (opts.search) {
    const q = opts.search.toLowerCase();
    orders = orders.filter((o) =>
      String(o.id).includes(q) ||
      o.customer.name.toLowerCase().includes(q) ||
      o.customer.email.toLowerCase().includes(q) ||
      o.items.some((i) => i.name.toLowerCase().includes(q))
    );
  }
  if (opts.minTotal !== '' && opts.minTotal != null) orders = orders.filter((o) => o.total >= parseFloat(opts.minTotal));
  if (opts.maxTotal !== '' && opts.maxTotal != null) orders = orders.filter((o) => o.total <= parseFloat(opts.maxTotal));

  const dir = opts.dir === 'asc' ? 1 : -1;
  const keyFns = {
    customer: (o) => o.customer.name,
    items: (o) => o.items.length,
    payment: (o) => o.payment_method,
    total: (o) => o.total,
    refunded: (o) => o.refunded,
    status: (o) => o.status,
    id: (o) => o.id,
    date: (o) => o.date,
  };
  const keyFn = keyFns[opts.sort] || keyFns.date;
  orders = [...orders].sort((a, b) => (keyFn(a) > keyFn(b) ? 1 : keyFn(a) < keyFn(b) ? -1 : 0) * dir);

  const total = orders.length;
  const offset = (opts.page - 1) * opts.perPage;
  return { rows: orders.slice(offset, offset + opts.perPage), total, page: opts.page, per_page: opts.perPage };
}

export async function orderDetail(orderId) {
  const raw = await wooClient.get(`orders/${orderId}`, {});
  return normalizeOrder(raw);
}

export function aggregateProducts(orders) {
  const agg = {};
  const revOrders = orders.filter((o) => isRevenueStatus(o.status));
  for (const o of revOrders) {
    for (const i of o.items) {
      const pid = i.product_id || i.name;
      agg[pid] ??= { product_id: pid, name: i.name, sku: i.sku, units: 0, gross: 0, refunds: 0 };
      agg[pid].units += i.qty;
      agg[pid].gross += i.total;
    }
  }
  // Refunds attributed proportionally by each item's share of the order subtotal.
  for (const o of orders) {
    if (o.refunded <= 0 || !o.subtotal) continue;
    for (const i of o.items) {
      const pid = i.product_id || i.name;
      if (!agg[pid]) continue;
      agg[pid].refunds += o.refunded * (i.total / o.subtotal);
    }
  }
  const totalGross = sum(Object.values(agg).map((p) => p.gross)) || 1;
  return Object.values(agg).map((p) => ({
    ...p,
    gross: round2(p.gross),
    refunds: round2(p.refunds),
    net: round2(p.gross - p.refunds),
    aov: p.units ? round2(p.gross / p.units) : 0,
    share: round4(p.gross / totalGross),
  }));
}

export async function listProducts(range, opts) {
  const orders = await fetchOrdersInRange(range);
  let rows = aggregateProducts(orders);

  if (opts.search) {
    const q = opts.search.toLowerCase();
    rows = rows.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }
  const sortKeyMap = { revenue: 'gross', units: 'units', aov: 'aov', refunds: 'refunds', lowest: 'gross' };
  const key = sortKeyMap[opts.sort] || 'gross';
  rows = [...rows].sort((a, b) => (opts.sort === 'lowest' ? a[key] - b[key] : b[key] - a[key]));

  const total = rows.length;
  const offset = (opts.page - 1) * opts.perPage;
  return { rows: rows.slice(offset, offset + opts.perPage), total, page: opts.page, per_page: opts.perPage };
}

export async function topProducts(range, limit) {
  const orders = await fetchOrdersInRange(range);
  const rows = aggregateProducts(orders).sort((a, b) => b.gross - a.gross);
  return rows.slice(0, limit);
}

export function aggregateCustomers(orders) {
  const byEmail = {};
  for (const o of orders.filter((o) => isRevenueStatus(o.status))) {
    const email = o.customer.email || `guest-${o.id}`;
    byEmail[email] ??= { name: o.customer.name, email: o.customer.email, orders: 0, ltv: 0, last_purchase: o.date };
    byEmail[email].orders++;
    byEmail[email].ltv += o.total;
    if (o.date > byEmail[email].last_purchase) byEmail[email].last_purchase = o.date;
  }
  for (const c of Object.values(byEmail)) {
    c.aov = c.orders ? round2(c.ltv / c.orders) : 0;
    c.ltv = round2(c.ltv);
  }
  return byEmail;
}

export async function listCustomers(range, opts) {
  const orders = await fetchOrdersInRange(range);
  let rows = Object.values(aggregateCustomers(orders));

  if (opts.search) {
    const q = opts.search.toLowerCase();
    rows = rows.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }
  const sortMap = { ltv: 'ltv', orders: 'orders', recent: 'last_purchase', aov: 'aov' };
  const key = sortMap[opts.sort] || 'ltv';
  rows = [...rows].sort((a, b) => (key === 'last_purchase' ? new Date(b[key]) - new Date(a[key]) : b[key] - a[key]));

  const total = rows.length;
  const offset = (opts.page - 1) * opts.perPage;
  return { rows: rows.slice(offset, offset + opts.perPage), total, page: opts.page, per_page: opts.perPage };
}

export async function customerSummary(range) {
  const orders = await fetchOrdersInRange(range);
  const byEmail = aggregateCustomers(orders);
  const total = Object.keys(byEmail).length;

  // "New" vs "returning": for each customer, check whether WooCommerce has any
  // earlier revenue-recognized order from the same billing email.
  let newCount = 0;
  for (const [email, c] of Object.entries(byEmail)) {
    if (!email || email.startsWith('guest-')) { newCount++; continue; }
    const earlier = await wooClient.get('orders', {
      search: c.email,
      before: `${range.start}T00:00:00`,
      status: 'completed,processing',
      per_page: 1,
      _fields: 'id',
    });
    if (!earlier || earlier.length === 0) newCount++;
  }

  return {
    total_customers: total,
    new_customers: newCount,
    returning_customers: total - newCount,
    avg_ltv: total ? round2(sum(Object.values(byEmail).map((c) => c.ltv)) / total) : 0,
  };
}

export async function refundSummary(range) {
  const orders = await fetchOrdersInRange(range);
  const revOrders = orders.filter((o) => isRevenueStatus(o.status));
  const refundOrders = orders.filter((o) => o.refunded > 0);

  const totalRefunded = sum(refundOrders.map((o) => o.refunded));
  const totalDiscounts = sum(revOrders.map((o) => o.discount));
  const grossBefore = sum(revOrders.map((o) => o.subtotal + o.shipping + o.tax));

  return {
    total_refunded: round2(totalRefunded),
    refunded_orders: refundOrders.length,
    refund_rate: orders.length ? round4(refundOrders.length / orders.length) : 0,
    total_discounts: round2(totalDiscounts),
    avg_discount: revOrders.length ? round2(totalDiscounts / revOrders.length) : 0,
    sales_before_discount: round2(grossBefore),
    sales_after_discount: round2(grossBefore - totalDiscounts),
  };
}

export async function refundTrend(range, granularity) {
  const orders = (await fetchOrdersInRange(range)).filter((o) => o.refunded > 0);
  const relabelled = orders.map((o) => ({ ...o, subtotal: o.refunded, shipping: 0, tax: 0, discount: 0 }));
  return bucketOrders(relabelled, range, granularity);
}

export async function refundedProducts(range, limit) {
  const orders = await fetchOrdersInRange(range);
  const rows = aggregateProducts(orders)
    .filter((p) => p.refunds > 0)
    .sort((a, b) => b.refunds - a.refunds)
    .slice(0, limit);
  return rows.map((p) => ({ name: p.name, amount: p.refunds }));
}

// ---- small helpers (exported so marketing.js reuses identical rounding) ----
export function sum(arr) { return arr.reduce((a, b) => a + b, 0); }
export function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
export function round4(n) { return Math.round((n + Number.EPSILON) * 10000) / 10000; }
