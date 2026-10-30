export function fmtMoney(value, currency = 'USD') {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  } catch {
    return '$' + Number(value).toFixed(2);
  }
}

export function fmtInt(value) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  );
}

export function titleCase(s) {
  return String(s)
    .replace(/-/g, ' ')
    .replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1));
}

export function computeRange(period, customStart, customEnd) {
  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  let start, end;

  switch (period) {
    case 'today': start = startOf(today); end = startOf(today); break;
    case 'yesterday': { const y = new Date(today); y.setDate(y.getDate() - 1); start = end = startOf(y); break; }
    case '7d': { end = startOf(today); start = new Date(end); start.setDate(start.getDate() - 6); break; }
    case '30d': { end = startOf(today); start = new Date(end); start.setDate(start.getDate() - 29); break; }
    case '90d': { end = startOf(today); start = new Date(end); start.setDate(start.getDate() - 89); break; }
    case 'this_month': start = new Date(today.getFullYear(), today.getMonth(), 1); end = startOf(today); break;
    case 'last_month': { const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1); start = lm; end = new Date(today.getFullYear(), today.getMonth(), 0); break; }
    case 'this_year': start = new Date(today.getFullYear(), 0, 1); end = startOf(today); break;
    case 'last_year': start = new Date(today.getFullYear() - 1, 0, 1); end = new Date(today.getFullYear() - 1, 11, 31); break;
    case 'custom': start = customStart ? new Date(customStart) : startOf(today); end = customEnd ? new Date(customEnd) : startOf(today); break;
    default: end = startOf(today); start = new Date(end); start.setDate(start.getDate() - 6);
  }
  return { start: fmt(start), end: fmt(end) };
}

export function csvEscape(value) {
  let v = String(value === null || value === undefined ? '' : value);
  // Prevent spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
  if (/[",\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
  return v;
}

export function toCsv(headers, rows) {
  return [headers.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))].join('\r\n');
}

export function downloadCsv(filename, csv) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
