/**
 * googleAdsClient.js
 *
 * Fetches daily cost/clicks/impressions/conversions per campaign from the
 * Google Ads API (via the community-maintained `google-ads-api` library —
 * there is no official Node.js client from Google). Pinned to v24.x, since
 * v25+ requires Node 22+ and this project targets Node 20 LTS (see
 * backend/README.md for the Oracle Cloud Node version).
 *
 * Entirely optional: if GOOGLE_ADS_ENABLED is false, or any credential is
 * missing, or the API call fails for any reason, callers get `null` back —
 * the Marketing & Ads tab's WooCommerce-side metrics (Sales by Channel,
 * Attribution Detail) keep working either way. Never a silent fabrication
 * of ad data when the real thing isn't available.
 */

import { config } from '../config.js';
import { cached } from './cache.js';

const CHANNEL_TYPE_LABELS = {
  0: 'Unspecified', 1: 'Unknown', 2: 'Search', 3: 'Display', 4: 'Shopping',
  5: 'Hotel', 6: 'Video', 7: 'Multi-channel', 8: 'Local', 9: 'Smart',
  10: 'Performance Max', 11: 'Local Services', 13: 'Travel', 14: 'Demand Gen',
};

function channelTypeLabel(raw) {
  if (raw == null) return 'Unknown';
  if (typeof raw === 'string') {
    // Already a string like "SEARCH" — title-case it for display.
    return raw.charAt(0) + raw.slice(1).toLowerCase().replace(/_/g, ' ');
  }
  return CHANNEL_TYPE_LABELS[raw] || 'Unknown';
}

let client = null;
async function getClient() {
  if (client) return client;
  // Lazy dynamic import: avoids pulling in the (fairly large) gRPC dependency
  // tree at server startup when the feature is disabled.
  const { GoogleAdsApi } = await import('google-ads-api');
  client = new GoogleAdsApi({
    client_id: config.googleAds.clientId,
    client_secret: config.googleAds.clientSecret,
    developer_token: config.googleAds.developerToken,
  });
  return client;
}

/**
 * Returns one row per date × campaign for the given range, or null if
 * Google Ads isn't configured/enabled or the request fails.
 * Shape: { date, campaign_id, campaign_name, campaign_type, cost, clicks,
 *          impressions, conversions, conversion_value }
 */
export async function getCampaignDailyData(range) {
  const ga = config.googleAds;
  if (!ga.enabled || !ga.clientId || !ga.clientSecret || !ga.developerToken || !ga.refreshToken || !ga.customerId) {
    return null;
  }

  const key = `gads_${ga.customerId}_${range.start}_${range.end}`;
  try {
    return await cached(key, async () => {
      const c = await getClient();
      const customer = c.Customer({
        customer_id: ga.customerId,
        login_customer_id: ga.loginCustomerId || undefined,
        refresh_token: ga.refreshToken,
      });

      const rows = await customer.report({
        entity: 'campaign',
        attributes: ['campaign.id', 'campaign.name', 'campaign.advertising_channel_type'],
        metrics: ['metrics.cost_micros', 'metrics.clicks', 'metrics.impressions', 'metrics.conversions', 'metrics.conversions_value'],
        segments: ['segments.date'],
        from_date: range.start,
        to_date: range.end,
      });

      return rows.map((r) => ({
        date: r.segments?.date || range.start,
        campaign_id: String(r.campaign?.id ?? ''),
        campaign_name: r.campaign?.name || 'Unknown campaign',
        campaign_type: channelTypeLabel(r.campaign?.advertising_channel_type),
        cost: Number(r.metrics?.cost_micros || 0) / 1_000_000,
        clicks: Number(r.metrics?.clicks || 0),
        impressions: Number(r.metrics?.impressions || 0),
        conversions: Number(r.metrics?.conversions || 0),
        conversion_value: Number(r.metrics?.conversions_value || 0),
      }));
    });
  } catch (err) {
    console.error('Google Ads request failed:', err.message); // eslint-disable-line no-console
    return null;
  }
}
