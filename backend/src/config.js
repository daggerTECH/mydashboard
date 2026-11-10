import 'dotenv/config';

function required(name, fallback = undefined) {
  const v = process.env[name] ?? fallback;
  return v;
}

export const config = {
  port: Number(process.env.PORT || 4000),
  isProd: process.env.NODE_ENV === 'production',
  frontendUrl: required('FRONTEND_URL', 'http://localhost:5173'),

  woocommerce: {
    storeUrl: (required('WC_STORE_URL', '') || '').replace(/\/+$/, ''),
    consumerKey: required('WC_CONSUMER_KEY', ''),
    consumerSecret: required('WC_CONSUMER_SECRET', ''),
    apiVersion: required('WC_API_VERSION', 'wc/v3'),
    verifySsl: required('WC_VERIFY_SSL', 'true') !== 'false',
    timeoutMs: Number(process.env.WC_TIMEOUT_MS || 20000),
  },

  auth: {
    username: required('DASHBOARD_USERNAME', 'admin'),
    passwordHash: required('DASHBOARD_PASSWORD_HASH', ''),
    jwtSecret: required('JWT_SECRET', ''),
  },

  cache: {
    ttlSeconds: Number(process.env.CACHE_TTL_SECONDS || 300),
  },

  // Optional. When disabled (the default), the Sales Overview's Conversion
  // Rate card shows "Requires Google Analytics 4 integration" rather than
  // estimating a rate from order counts alone. See backend/README.md §6.
  ga4: {
    enabled: required('GA4_ENABLED', 'false') === 'true',
    propertyId: required('GA4_PROPERTY_ID', ''),
    // GOOGLE_APPLICATION_CREDENTIALS (a path to a service-account JSON key)
    // is read directly by the Google client library — it's Google's own
    // standard env var name, not something this project invents.
  },

  // Optional. Powers the Marketing & Ads tab's ad-spend side (cost, clicks,
  // impressions, conversions per campaign). When disabled, that tab still
  // shows Sales by Channel and Attribution Detail from WooCommerce alone —
  // see backend/README.md §7 for the full OAuth + developer token setup.
  googleAds: {
    enabled: required('GOOGLE_ADS_ENABLED', 'false') === 'true',
    clientId: required('GOOGLE_ADS_CLIENT_ID', ''),
    clientSecret: required('GOOGLE_ADS_CLIENT_SECRET', ''),
    developerToken: required('GOOGLE_ADS_DEVELOPER_TOKEN', ''),
    refreshToken: required('GOOGLE_ADS_REFRESH_TOKEN', ''),
    customerId: required('GOOGLE_ADS_CUSTOMER_ID', ''), // digits only, no dashes
    loginCustomerId: required('GOOGLE_ADS_LOGIN_CUSTOMER_ID', ''), // only needed if accessed via an MCC/manager account
  },

  rateLimit: {
    max: Number(process.env.RATE_LIMIT_MAX || 120),
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  },
};

export function assertConfigured() {
  const problems = [];
  if (!config.woocommerce.storeUrl) problems.push('WC_STORE_URL is not set');
  if (!config.woocommerce.consumerKey || config.woocommerce.consumerKey.includes('xxxxxxxxxxxx'))
    problems.push('WC_CONSUMER_KEY is not set');
  if (!config.woocommerce.consumerSecret || config.woocommerce.consumerSecret.includes('xxxxxxxxxxxx'))
    problems.push('WC_CONSUMER_SECRET is not set');
  if (!config.auth.jwtSecret) problems.push('JWT_SECRET is not set');
  if (!config.auth.passwordHash || config.auth.passwordHash.includes('REPLACE_WITH'))
    problems.push('DASHBOARD_PASSWORD_HASH is not set');
  return problems;
}
