import { Router } from 'express';
import { wooClient, WcApiError } from '../services/wooClient.js';
import { sanitizeDate, sanitizeEnum, sanitizeInt, sanitizeString } from '../services/sanitize.js';
import * as agg from '../services/aggregations.js';

const router = Router();

function getRange(req) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    start: sanitizeDate(req.query.start, today),
    end: sanitizeDate(req.query.end, today),
  };
}

function ok(res, data) { res.json({ success: true, data }); }

function asyncRoute(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

router.get('/connection-status', asyncRoute(async (req, res) => {
  await wooClient.ping();
  ok(res, { connected: true, demo: false });
}));

router.get('/store-settings', asyncRoute(async (req, res) => {
  const general = await wooClient.generalSettings();
  ok(res, {
    store_url: process.env.WC_STORE_URL || '',
    currency: general.currency,
    timezone: process.env.TZ || 'UTC',
    date_format: 'MMM D, YYYY',
  });
}));

router.get('/sales-summary', asyncRoute(async (req, res) => ok(res, await agg.salesSummary(getRange(req)))));

router.get('/revenue-series', asyncRoute(async (req, res) => {
  const granularity = sanitizeEnum(req.query.granularity, ['daily', 'weekly', 'monthly'], 'daily');
  ok(res, await agg.revenueSeries(getRange(req), granularity));
}));

router.get('/order-status-breakdown', asyncRoute(async (req, res) => ok(res, await agg.orderStatusBreakdown(getRange(req)))));

router.get('/payment-methods', asyncRoute(async (req, res) => ok(res, await agg.paymentMethodBreakdown(getRange(req)))));

router.get('/orders', asyncRoute(async (req, res) => {
  const opts = {
    page: sanitizeInt(req.query.page, 1, 1, 100000),
    perPage: sanitizeInt(req.query.per_page, 20, 1, 10000),
    status: sanitizeString(req.query.status, 40),
    payment: sanitizeString(req.query.payment, 80),
    search: sanitizeString(req.query.search, 100),
    minTotal: sanitizeString(req.query.min_total, 20),
    maxTotal: sanitizeString(req.query.max_total, 20),
    sort: sanitizeEnum(req.query.sort, ['id', 'date', 'customer', 'items', 'total', 'refunded', 'payment', 'status'], 'date'),
    dir: sanitizeEnum(req.query.dir, ['asc', 'desc'], 'desc'),
  };
  ok(res, await agg.listOrders(getRange(req), opts));
}));

router.get('/order-detail', asyncRoute(async (req, res) => {
  const orderId = sanitizeInt(req.query.order_id, 0, 1, Number.MAX_SAFE_INTEGER);
  if (!orderId) throw new WcApiError('A valid order_id is required.', 400);
  ok(res, await agg.orderDetail(orderId));
}));

router.get('/products', asyncRoute(async (req, res) => {
  const opts = {
    page: sanitizeInt(req.query.page, 1, 1, 100000),
    perPage: sanitizeInt(req.query.per_page, 20, 1, 10000),
    search: sanitizeString(req.query.search, 100),
    sort: sanitizeEnum(req.query.sort, ['revenue', 'units', 'aov', 'refunds', 'lowest'], 'revenue'),
  };
  ok(res, await agg.listProducts(getRange(req), opts));
}));

router.get('/top-products', asyncRoute(async (req, res) => {
  const limit = sanitizeInt(req.query.limit, 10, 1, 50);
  ok(res, await agg.topProducts(getRange(req), limit));
}));

router.get('/customers', asyncRoute(async (req, res) => {
  const opts = {
    page: sanitizeInt(req.query.page, 1, 1, 100000),
    perPage: sanitizeInt(req.query.per_page, 20, 1, 10000),
    search: sanitizeString(req.query.search, 100),
    sort: sanitizeEnum(req.query.sort, ['ltv', 'orders', 'recent', 'aov'], 'ltv'),
  };
  ok(res, await agg.listCustomers(getRange(req), opts));
}));

router.get('/customer-summary', asyncRoute(async (req, res) => ok(res, await agg.customerSummary(getRange(req)))));

router.get('/refund-summary', asyncRoute(async (req, res) => ok(res, await agg.refundSummary(getRange(req)))));

router.get('/refund-trend', asyncRoute(async (req, res) => {
  const granularity = sanitizeEnum(req.query.granularity, ['daily', 'weekly', 'monthly'], 'daily');
  ok(res, await agg.refundTrend(getRange(req), granularity));
}));

router.get('/refunded-products', asyncRoute(async (req, res) => {
  const limit = sanitizeInt(req.query.limit, 8, 1, 50);
  ok(res, await agg.refundedProducts(getRange(req), limit));
}));

export default router;
