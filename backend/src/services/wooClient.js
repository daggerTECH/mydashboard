import axios from 'axios';
import https from 'node:https';
import { config } from '../config.js';
import { cached } from './cache.js';

export class WcApiError extends Error {
  constructor(message, httpStatus = 502) {
    super(message);
    this.httpStatus = httpStatus;
  }
}

const client = axios.create({
  baseURL: `${config.woocommerce.storeUrl}/wp-json/${config.woocommerce.apiVersion}`,
  timeout: config.woocommerce.timeoutMs,
  httpsAgent: new https.Agent({ rejectUnauthorized: config.woocommerce.verifySsl }),
  params: {
    consumer_key: config.woocommerce.consumerKey,
    consumer_secret: config.woocommerce.consumerSecret,
  },
});

function normalizeAxiosError(err) {
  if (err.code === 'ECONNABORTED') return new WcApiError('Timed out while contacting the WooCommerce store.', 504);
  if (!err.response) return new WcApiError('Could not reach the WooCommerce store.', 502);
  const status = err.response.status;
  if (status === 401 || status === 403) {
    return new WcApiError('WooCommerce rejected the API credentials. Check the Consumer Key/Secret and their permissions.', 401);
  }
  if (status === 429) return new WcApiError('WooCommerce API rate limit reached.', 429);
  if (status >= 500) return new WcApiError('The WooCommerce store returned a server error.', 502);
  const msg = err.response.data?.message || 'The WooCommerce store rejected this request.';
  return new WcApiError(msg, status);
}

if (config.woocommerce.consumerKey.includes('xxxxxxxxxxxx') || !config.woocommerce.consumerKey) {
  // Not fatal at import time (lets the server still boot to show a clear error),
  // but every real request will fail fast with a clear message below.
}

function assertConfigured() {
  if (!config.woocommerce.consumerKey || config.woocommerce.consumerKey.includes('xxxxxxxxxxxx')) {
    throw new WcApiError('WooCommerce API credentials are not configured. Set WC_CONSUMER_KEY/WC_CONSUMER_SECRET in the backend .env file.', 401);
  }
}

async function request(path, params = {}) {
  const { data } = await requestWithHeaders(path, params);
  return data;
}

/** Like request(), but also returns response headers — needed to read
 * WordPress's X-WP-TotalPages header for the pagination fast-path below. */
async function requestWithHeaders(path, params = {}) {
  assertConfigured();
  try {
    const res = await client.get(path, { params });
    return { data: res.data, headers: res.headers };
  } catch (err) {
    throw normalizeAxiosError(err);
  }
}

/** Same bounded-concurrency helper as aggregations.js::mapWithConcurrency —
 * duplicated locally so this file has no dependency on that one. */
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Fetch every page of a listing endpoint, up to a hard safety limit.
 *
 * Fetches page 1 first and reads WordPress's X-WP-TotalPages response
 * header to learn how many pages actually exist, then fetches every
 * remaining page CONCURRENTLY (bounded to 6 at a time) instead of one at a
 * time — for a date range spanning many pages of orders (e.g. "This year"
 * on a busy store), this is the difference between N sequential round-trips
 * and roughly N/6. If that header is ever missing or unparseable (some
 * WooCommerce setups/proxies can strip custom headers), falls back to the
 * original, slower but guaranteed-correct sequential loop rather than risk
 * silently dropping orders beyond page 1.
 */
async function getAllPages(path, params = {}, hardPageLimit = 20) {
  const perPage = 100;
  const first = await requestWithHeaders(path, { ...params, page: 1, per_page: perPage });
  const firstBatch = first.data;

  const totalPagesHeader = parseInt(first.headers?.['x-wp-totalpages'], 10);
  const headerUsable = Number.isInteger(totalPagesHeader) && totalPagesHeader >= 1;

  if (!headerUsable) {
    // Fallback: proven sequential loop, continuing from page 2 (page 1 is
    // already fetched above, so this never redoes work).
    let all = firstBatch.slice();
    let page = 2;
    let lastBatch = firstBatch;
    while (lastBatch.length === perPage && page <= hardPageLimit) {
      const batch = await request(path, { ...params, page, per_page: perPage });
      all = all.concat(batch);
      lastBatch = batch;
      page++;
    }
    return all;
  }

  const totalPages = Math.min(totalPagesHeader, hardPageLimit);
  if (totalPages <= 1) return firstBatch;

  const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2); // [2, 3, ..., totalPages]
  const remainingBatches = await mapWithConcurrency(remainingPages, 6, (page) =>
    request(path, { ...params, page, per_page: perPage })
  );

  return [firstBatch, ...remainingBatches].flat();
}

function cacheKey(prefix, path, params) {
  return `${prefix}_${path}_${JSON.stringify(params)}`;
}

export const wooClient = {
  get: (path, params) => cached(cacheKey('get', path, params), () => request(path, params)),
  getAllPages: (path, params, hardPageLimit) =>
    cached(cacheKey('all', path, params), () => getAllPages(path, params, hardPageLimit)),

  /** Uncached — used for the Settings "Test connection" / connection-status check. */
  ping: () => request('system_status', {}),

  async generalSettings() {
    const raw = await cached(cacheKey('get', 'settings/general', {}), () => request('settings/general', {}));
    const map = Object.fromEntries((raw || []).map((r) => [r.id, r.value]));
    return { currency: map.woocommerce_currency || 'USD' };
  },
};
