import { Router } from 'express';
import { sanitizeDate, sanitizeEnum, sanitizeInt, sanitizeString } from '../services/sanitize.js';
import * as marketing from '../services/marketing.js';
import { CHANNEL_ORDER } from '../services/channelMapping.js';

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

router.get('/marketing-summary', asyncRoute(async (req, res) => ok(res, await marketing.marketingSummary(getRange(req)))));

router.get('/sales-by-channel', asyncRoute(async (req, res) => ok(res, await marketing.salesByChannel(getRange(req)))));

router.get('/attribution-detail', asyncRoute(async (req, res) => {
  const opts = {
    page: sanitizeInt(req.query.page, 1, 1, 100000),
    perPage: sanitizeInt(req.query.per_page, 20, 1, 10000),
    search: sanitizeString(req.query.search, 100),
    channel: sanitizeEnum(req.query.channel, CHANNEL_ORDER, ''),
  };
  ok(res, await marketing.attributionDetail(getRange(req), opts));
}));

router.get('/ads-trend', asyncRoute(async (req, res) => {
  const granularity = sanitizeEnum(req.query.granularity, ['daily', 'weekly', 'monthly'], 'daily');
  ok(res, await marketing.adsTrend(getRange(req), granularity));
}));

router.get('/campaign-performance', asyncRoute(async (req, res) => {
  const opts = {
    page: sanitizeInt(req.query.page, 1, 1, 100000),
    perPage: sanitizeInt(req.query.per_page, 20, 1, 10000),
    search: sanitizeString(req.query.search, 100),
    sort: sanitizeEnum(req.query.sort, ['cost', 'clicks', 'impressions', 'store_orders', 'store_revenue', 'acos_store', 'roas'], 'cost'),
  };
  ok(res, await marketing.campaignPerformance(getRange(req), opts));
}));

export default router;
