/**
 * ga4Client.js
 *
 * Thin wrapper around Google's official Analytics Data API client, used
 * only to fetch session counts for the Conversion Rate card. Everything
 * here is optional: if GA4_ENABLED is false, or the property/credentials
 * aren't configured, or Google's API errors for any reason, callers get
 * `null` back and the dashboard falls back to "Requires Google Analytics 4
 * integration" — it never estimates a conversion rate from order counts
 * alone (see aggregations.js::salesSummary).
 */

import { config } from '../config.js';
import { cached } from './cache.js';

let client = null;

/** Lazily constructs the client so a missing/invalid key file doesn't crash
 * the server at import time — only the first real GA4 request will fail. */
async function getClient() {
  if (client) return client;
  const { BetaAnalyticsDataClient } = await import('@google-analytics/data');
  // No args: the client reads the service-account key from the standard
  // GOOGLE_APPLICATION_CREDENTIALS env var (Google's own convention).
  client = new BetaAnalyticsDataClient();
  return client;
}

/**
 * Returns the number of GA4 sessions for the given date range, or null if
 * GA4 isn't configured/enabled or the request fails for any reason.
 */
export async function getSessions(range) {
  if (!config.ga4.enabled || !config.ga4.propertyId) return null;

  const key = `ga4_sessions_${config.ga4.propertyId}_${range.start}_${range.end}`;
  try {
    return await cached(key, async () => {
      const c = await getClient();
      const [response] = await c.runReport({
        property: `properties/${config.ga4.propertyId}`,
        dateRanges: [{ startDate: range.start, endDate: range.end }],
        metrics: [{ name: 'sessions' }],
      });
      const raw = response.rows?.[0]?.metricValues?.[0]?.value;
      return raw != null ? parseInt(raw, 10) : 0;
    });
  } catch (err) {
    // Log server-side for the operator, but never let a GA4 hiccup break
    // the rest of the Sales Overview page.
    console.error('GA4 request failed:', err.message); // eslint-disable-line no-console
    return null;
  }
}
