/**
 * marketing.js
 *
 * ===========================================================================
 * METRIC DEFINITIONS — Marketing & Ads tab
 * ===========================================================================
 * Revenue here uses the SAME definitions as the Sales Overview page:
 *   Gross sales (per channel) = item subtotal + shipping + tax, revenue-
 *                               recognized orders (completed/processing) only
 *   Net sales   (per channel) = Gross sales − discounts − refunds
 * Summing every channel's net sales equals the dashboard's total net sales
 * for the same period — nothing lost or double-counted (see acceptance
 * checklist in the "Marketing & Ads" brief).
 *
 *   ACOS (Store)    = Google Ads cost ÷ net sales of orders whose Channel
 *                     = "Google Ads" — THE headline number, because it's
 *                     based on real paid orders rather than Google's own
 *                     attribution model.
 *   ACOS (Google)   = Google Ads cost ÷ Google Ads' own reported conversion
 *                     value. Shown only for comparison.
 *   ROAS            = inverse of ACOS (Store): store revenue ÷ ad spend.
 *   TACOS           = Google Ads cost ÷ TOTAL store net sales (every
 *                     channel), i.e. ad spend's cost relative to the whole
 *                     business, not just ad-attributed sales.
 *   Gap             = Google-reported conversion value − store net sales
 *                     attributed to Google Ads. A sudden jump usually means
 *                     tracking broke somewhere (see brief §4).
 *
 * Every ratio handles divide-by-zero by returning null — the frontend shows
 * "—", never a fabricated 0% or Infinity. All Google-Ads-dependent figures
 * are null with ads_available:false when Google Ads isn't configured; the
 * WooCommerce-only figures (Sales by Channel, Attribution Detail) are always
 * available regardless.
 * ===========================================================================
 */

import { fetchOrdersInRange, isRevenueStatus, previousEqualRange, sum, round2, round4 } from './aggregations.js';
import { getCampaignDailyData } from './googleAdsClient.js';
import { CHANNEL_ORDER } from './channelMapping.js';

function safeDiv(numerator, denominator) {
  if (!denominator || denominator === 0 || numerator == null) return null;
  return numerator / denominator;
}

/** Gross/net sales for revenue-recognized orders, grouped by Channel. */
export async function salesByChannel(range) {
  const orders = await fetchOrdersInRange(range);
  const revOrders = orders.filter((o) => isRevenueStatus(o.status));

  const byChannel = {};
  const ensure = (ch) => (byChannel[ch] ??= { channel: ch, orders: 0, gross: 0, discount: 0, refunds: 0 });

  for (const o of revOrders) {
    const row = ensure(o.channel);
    row.orders += 1;
    row.gross += o.subtotal + o.shipping + o.tax;
    row.discount += o.discount;
  }
  // Refunds belong to the channel of their ORIGINAL order, regardless of
  // that order's current status (mirrors the Sales Overview's refund rule).
  for (const o of orders) {
    if (o.refunded > 0) ensure(o.channel).refunds += o.refunded;
  }

  const rows = Object.values(byChannel).map((r) => ({
    channel: r.channel,
    orders: r.orders,
    gross: round2(r.gross),
    net: round2(r.gross - r.discount - r.refunds),
    aov: r.orders ? round2((r.gross - r.discount - r.refunds) / r.orders) : 0,
  }));

  const totalGross = sum(rows.map((r) => r.gross)) || 1;
  rows.forEach((r) => { r.share = round4(r.gross / totalGross); });

  // Stable, brief-specified display order; channels with no orders this
  // period are omitted rather than shown as a row of zeros.
  rows.sort((a, b) => CHANNEL_ORDER.indexOf(a.channel) - CHANNEL_ORDER.indexOf(b.channel));
  return rows;
}

/** Raw source/medium/campaign/referrer combinations, for drilling into why an order was classified a given way. */
export async function attributionDetail(range, opts) {
  const orders = await fetchOrdersInRange(range);
  const revOrders = orders.filter((o) => isRevenueStatus(o.status));

  const groups = {};
  for (const o of revOrders) {
    const a = o.attribution;
    const key = [a.sourceType || '—', a.source || '—', a.medium || '—', a.campaign || '—', a.referrer || '—'].join('||');
    groups[key] ??= {
      source_type: a.sourceType || '—', source: a.source || '—', medium: a.medium || '—',
      campaign: a.campaign || '—', referrer: a.referrer || '—', channel: o.channel,
      orders: 0, revenue: 0,
    };
    groups[key].orders += 1;
    groups[key].revenue += o.total;
  }

  let rows = Object.values(groups).map((g) => ({ ...g, revenue: round2(g.revenue) }));

  if (opts.search) {
    const q = opts.search.toLowerCase();
    rows = rows.filter((r) =>
      [r.source, r.medium, r.campaign, r.referrer, r.channel].some((v) => v.toLowerCase().includes(q))
    );
  }
  if (opts.channel) rows = rows.filter((r) => r.channel === opts.channel);

  rows.sort((a, b) => b.orders - a.orders);

  const total = rows.length;
  const offset = (opts.page - 1) * opts.perPage;
  const unknownOrders = revOrders.filter((o) => o.channel === 'Unknown').length;

  return {
    rows: rows.slice(offset, offset + opts.perPage),
    total, page: opts.page, per_page: opts.perPage,
    pct_unknown: revOrders.length ? round4(unknownOrders / revOrders.length) : 0,
  };
}

/** Net sales of orders attributed to the "Google Ads" channel, from an already-fetched orders array. */
function googleAdsChannelRevenueFromOrders(orders) {
  const revOrders = orders.filter((o) => isRevenueStatus(o.status) && o.channel === 'Google Ads');
  const gross = sum(revOrders.map((o) => o.subtotal + o.shipping + o.tax));
  const discount = sum(revOrders.map((o) => o.discount));
  const refunds = sum(orders.filter((o) => o.channel === 'Google Ads').map((o) => o.refunded));
  return { net: gross - discount - refunds, orders: revOrders.length };
}

/** Total store net sales across every channel, from an already-fetched orders array (identical formula to the Sales Overview page). */
function totalStoreNetSalesFromOrders(orders) {
  const revOrders = orders.filter((o) => isRevenueStatus(o.status));
  const gross = sum(revOrders.map((o) => o.subtotal + o.shipping + o.tax));
  const discount = sum(revOrders.map((o) => o.discount));
  const refunds = sum(orders.map((o) => o.refunded));
  return gross - discount - refunds;
}

export async function marketingSummary(range) {
  const prevRange = previousEqualRange(range);

  // The four independent, potentially-slow calls this KPI row needs — run
  // concurrently instead of one after another. Each order-range is fetched
  // exactly once (not re-fetched per metric), which matters for stores with
  // real order volume: this endpoint used to serially re-fetch the same
  // WooCommerce order history multiple times and could exceed the
  // frontend's request timeout on a busy month.
  const [adsRows, prevAdsRows, orders, prevOrders] = await Promise.all([
    getCampaignDailyData(range),
    getCampaignDailyData(prevRange),
    fetchOrdersInRange(range),
    fetchOrdersInRange(prevRange),
  ]);

  const adsAvailable = adsRows != null;
  const adSpend = adsAvailable ? sum(adsRows.map((r) => r.cost)) : null;
  const googleConvValue = adsAvailable ? sum(adsRows.map((r) => r.conversion_value)) : null;

  const { net: googleAdsRevenueStore } = googleAdsChannelRevenueFromOrders(orders);
  const totalRevenue = totalStoreNetSalesFromOrders(orders);

  const acosStore = adsAvailable ? safeDiv(adSpend, googleAdsRevenueStore) : null;
  const acosGoogle = adsAvailable ? safeDiv(adSpend, googleConvValue) : null;
  const roas = adsAvailable ? safeDiv(googleAdsRevenueStore, adSpend) : null;
  const tacos = adsAvailable ? safeDiv(adSpend, totalRevenue) : null;
  const gap = adsAvailable && googleConvValue != null ? round2(googleConvValue - googleAdsRevenueStore) : null;

  // Previous period, for the "change vs previous period" trend on each KPI card.
  const prevAdSpend = prevAdsRows ? sum(prevAdsRows.map((r) => r.cost)) : null;
  const { net: prevGoogleAdsRevenue } = googleAdsChannelRevenueFromOrders(prevOrders);
  const prevTotalRevenue = totalStoreNetSalesFromOrders(prevOrders);
  const prevAcosStore = prevAdsRows ? safeDiv(prevAdSpend, prevGoogleAdsRevenue) : null;
  const prevRoas = prevAdsRows ? safeDiv(prevGoogleAdsRevenue, prevAdSpend) : null;

  return {
    ads_available: adsAvailable,
    ad_spend: adsAvailable ? round2(adSpend) : null,
    ad_spend_prev: prevAdSpend != null ? round2(prevAdSpend) : null,
    google_ads_revenue_store: round2(googleAdsRevenueStore),
    google_ads_revenue_store_prev: round2(prevGoogleAdsRevenue),
    acos_store: acosStore != null ? round4(acosStore) : null,
    acos_store_prev: prevAcosStore != null ? round4(prevAcosStore) : null,
    acos_google: acosGoogle != null ? round4(acosGoogle) : null,
    roas: roas != null ? round4(roas) : null,
    roas_prev: prevRoas != null ? round4(prevRoas) : null,
    tacos: tacos != null ? round4(tacos) : null,
    total_revenue: round2(totalRevenue),
    total_revenue_prev: round2(prevTotalRevenue),
    google_conversion_value: googleConvValue != null ? round2(googleConvValue) : null,
    gap,
  };
}

/** Daily/weekly/monthly ad spend vs. Google-Ads-channel store revenue, with ACOS as a derived line. */
export async function adsTrend(range, granularity) {
  const [adsRows, allOrders] = await Promise.all([getCampaignDailyData(range), fetchOrdersInRange(range)]);
  if (!adsRows) return { available: false, labels: [], spend: [], revenue: [], acos: [] };

  const orders = allOrders.filter((o) => isRevenueStatus(o.status) && o.channel === 'Google Ads');

  const labels = []; const spend = []; const revenue = []; const acos = [];
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

    const adsInBucket = adsRows.filter((r) => { const d = new Date(r.date); return d >= bucketStart && d <= bucketEnd; });
    const ordersInBucket = orders.filter((o) => { const d = new Date(o.date.slice(0, 10)); return d >= bucketStart && d <= bucketEnd; });

    const bucketSpend = sum(adsInBucket.map((r) => r.cost));
    const bucketRevenue = sum(ordersInBucket.map((o) => o.subtotal + o.shipping + o.tax - o.discount - o.refunded));

    labels.push(fmt(bucketStart));
    spend.push(round2(bucketSpend));
    revenue.push(round2(bucketRevenue));
    acos.push(safeDiv(bucketSpend, bucketRevenue));
  }

  return { available: true, labels, spend, revenue, acos };
}

/**
 * Matches a WooCommerce utm_campaign value against a Google Ads campaign,
 * per the brief's tracking-template assumption: the final URL suffix embeds
 * either {campaignname} or {campaignid}. Falls back to no match (store
 * columns show "—") rather than guessing — a wrong match would silently
 * corrupt per-campaign ACOS, which is worse than an honest gap.
 */
function matchesCampaign(wooCampaign, adCampaignId, adCampaignName) {
  if (!wooCampaign) return false;
  const w = wooCampaign.toLowerCase().trim();
  if (w === String(adCampaignId)) return true;
  if (w.includes(String(adCampaignId))) return true;
  const normalizedAdName = adCampaignName.toLowerCase().trim().replace(/[\s_-]+/g, '');
  const normalizedWoo = w.replace(/[\s_-]+/g, '');
  return normalizedWoo === normalizedAdName || normalizedWoo.includes(normalizedAdName);
}

export async function campaignPerformance(range, opts) {
  const [adsRows, allOrders] = await Promise.all([getCampaignDailyData(range), fetchOrdersInRange(range)]);
  if (!adsRows) return { available: false, rows: [], total: 0, page: opts.page, per_page: opts.perPage };

  const byCampaign = {};
  for (const r of adsRows) {
    byCampaign[r.campaign_id] ??= {
      campaign_id: r.campaign_id, campaign_name: r.campaign_name, campaign_type: r.campaign_type,
      cost: 0, clicks: 0, impressions: 0, conversions: 0, conversion_value: 0,
    };
    const c = byCampaign[r.campaign_id];
    c.cost += r.cost; c.clicks += r.clicks; c.impressions += r.impressions;
    c.conversions += r.conversions; c.conversion_value += r.conversion_value;
  }

  // Two separate scans, same pattern as salesByChannel: order/revenue counts
  // come from currently revenue-recognized orders only, but refunds are
  // pulled from EVERY order regardless of its current status — a fully
  // refunded order (status flips away from completed/processing) must still
  // pull down the campaign's revenue, or ACOS would look artificially good.
  const googleAdsOrders = allOrders.filter((o) => o.channel === 'Google Ads');
  const revenueRecognizedOrders = googleAdsOrders.filter((o) => isRevenueStatus(o.status));

  let rows = Object.values(byCampaign).map((c) => {
    const matchedRevenue = revenueRecognizedOrders.filter((o) => matchesCampaign(o.attribution.campaign, c.campaign_id, c.campaign_name));
    const matchedAny = googleAdsOrders.filter((o) => matchesCampaign(o.attribution.campaign, c.campaign_id, c.campaign_name));
    const grossForCampaign = sum(matchedRevenue.map((o) => o.subtotal + o.shipping + o.tax - o.discount));
    const refundsForCampaign = sum(matchedAny.map((o) => o.refunded));
    const storeRevenue = grossForCampaign - refundsForCampaign;
    const storeOrders = matchedRevenue.length;
    return {
      campaign_id: c.campaign_id,
      campaign_name: c.campaign_name,
      campaign_type: c.campaign_type,
      cost: round2(c.cost),
      clicks: c.clicks,
      impressions: c.impressions,
      ctr: c.impressions ? round4(c.clicks / c.impressions) : null,
      cpc: c.clicks ? round2(c.cost / c.clicks) : null,
      store_orders: storeOrders,
      store_revenue: round2(storeRevenue),
      acos_store: storeOrders ? safeDiv(c.cost, storeRevenue) : null,
      google_conversion_value: round2(c.conversion_value),
      acos_google: safeDiv(c.cost, c.conversion_value),
      roas: storeOrders ? safeDiv(storeRevenue, c.cost) : null,
      matched: storeOrders > 0,
    };
  }).map((r) => ({
    ...r,
    acos_store: r.acos_store != null ? round4(r.acos_store) : null,
    acos_google: r.acos_google != null ? round4(r.acos_google) : null,
    roas: r.roas != null ? round4(r.roas) : null,
  }));

  if (opts.search) {
    const q = opts.search.toLowerCase();
    rows = rows.filter((r) => r.campaign_name.toLowerCase().includes(q));
  }
  const sortKey = opts.sort || 'cost';
  rows.sort((a, b) => (b[sortKey] ?? -Infinity) - (a[sortKey] ?? -Infinity));

  const total = rows.length;
  const offset = (opts.page - 1) * opts.perPage;
  return { available: true, rows: rows.slice(offset, offset + opts.perPage), total, page: opts.page, per_page: opts.perPage };
}
