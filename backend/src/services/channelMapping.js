/**
 * channelMapping.js
 *
 * Turns a WooCommerce order's raw Order Attribution meta fields into one
 * human-readable "Channel" — the single editable place the brief asked for.
 * Adjust the rules below as real data comes in; nothing else in the app
 * hard-codes channel logic.
 *
 * Input shape (see aggregations.js::extractAttribution):
 *   { sourceType, source, medium, campaign, term, content, referrer, deviceType }
 * All fields are lowercased strings, '' when WooCommerce didn't record them
 * (orders placed before Order Attribution was enabled, WC < 8.5, or blocked
 * by the visitor's cookie settings).
 */

const AI_ASSISTANT_HINTS = ['chatgpt', 'perplexity', 'gemini', 'copilot', 'claude.ai'];
const PAID_SOCIAL_SOURCES = ['facebook', 'instagram', 'tiktok', 'linkedin', 'twitter', 'x.com', 'pinterest', 'snapchat'];
const PAID_MEDIUMS = ['cpc', 'ppc', 'paid', 'paid-social', 'display', 'cpm'];
const SOCIAL_SOURCES = [...PAID_SOCIAL_SOURCES, 'reddit', 'youtube'];

function includesAny(haystack, needles) {
  return needles.some((n) => haystack.includes(n));
}

/**
 * @param {object} a - lowercased attribution fields for one order
 * @returns {string} one of the Channel names below
 */
export function classifyChannel(a) {
  const sourceType = a.sourceType || '';
  const source = a.source || '';
  const medium = a.medium || '';
  const referrer = a.referrer || '';

  // AI assistants first — these often arrive as "referral" or "organic" and
  // would otherwise get mis-bucketed before the more specific rules below.
  if (includesAny(source, AI_ASSISTANT_HINTS) || includesAny(referrer, AI_ASSISTANT_HINTS)) {
    return 'AI Assistants';
  }

  if (source.includes('google') && PAID_MEDIUMS.includes(medium)) return 'Google Ads';
  if (sourceType === 'organic' && source.includes('google')) return 'Google Organic';
  if (sourceType === 'organic') return 'Other Organic Search';

  if (includesAny(source, PAID_SOCIAL_SOURCES) && PAID_MEDIUMS.includes(medium)) return 'Paid Social';
  if (includesAny(source, SOCIAL_SOURCES)) return 'Organic Social';

  if (medium === 'email') return 'Email';

  if (sourceType === 'referral') return 'Referral';
  if (sourceType === 'typein') return 'Direct';
  if (sourceType === 'admin') return 'Admin / Manual';
  if (sourceType === 'mobile_app') return 'Mobile App';

  return 'Unknown';
}

/** Fixed display order for channel breakdowns, independent of data order. */
export const CHANNEL_ORDER = [
  'Google Ads', 'Google Organic', 'Other Organic Search', 'Paid Social',
  'Organic Social', 'Email', 'AI Assistants', 'Referral', 'Direct',
  'Mobile App', 'Admin / Manual', 'Unknown',
];
