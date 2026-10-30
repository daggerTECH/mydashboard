export function sanitizeDate(value, fallback) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return fallback;
}

export function sanitizeEnum(value, allowed, fallback = '') {
  return allowed.includes(value) ? value : fallback;
}

export function sanitizeInt(value, def, min, max) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

export function sanitizeString(value, maxLen = 200) {
  if (value == null) return '';
  const stripped = String(value).replace(/<[^>]*>/g, '').trim();
  return stripped.slice(0, maxLen);
}
