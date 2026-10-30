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

async function request(path, params = {}) {
  if (!config.woocommerce.consumerKey || config.woocommerce.consumerKey.includes('xxxxxxxxxxxx')) {
    throw new WcApiError('WooCommerce API credentials are not configured. Set WC_CONSUMER_KEY/WC_CONSUMER_SECRET in the backend .env file.', 401);
  }
  try {
    const res = await client.get(path, { params });
    return res.data;
  } catch (err) {
    throw normalizeAxiosError(err);
  }
}

/** Fetch every page of a listing endpoint, up to a hard safety limit. */
async function getAllPages(path, params = {}, hardPageLimit = 20) {
  let all = [];
  let page = 1;
  do {
    const batch = await request(path, { ...params, page, per_page: 100 });
    all = all.concat(batch);
    page++;
    if (batch.length < 100) break;
  } while (page <= hardPageLimit);
  return all;
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
