export const ADVISORY_EXPORT_COLUMNS = [
  'created_at',
  'symbol',
  'side',
  'confidence',
  'summary',
  'outcome_t1',
  'outcome_t3',
  'outcome_t5',
];

export const ADVISORY_EXPORT_MAX_ROWS = 5000;

export function advisoryCsvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toAdvisoryCsvRow(item) {
  const advisory = item || {};
  return {
    created_at: advisory.created_at || '',
    symbol: advisory.symbol || '',
    side: advisory.side || '',
    confidence: advisory.confidence ?? '',
    summary: advisory.ai_summary || advisory.summary || '',
    outcome_t1: advisory.outcome_t1 ?? '',
    outcome_t3: advisory.outcome_t3 ?? '',
    outcome_t5: advisory.outcome_t5 ?? '',
  };
}

export function buildAdvisoryCsv(items) {
  const rows = (Array.isArray(items) ? items : [])
    .slice(0, ADVISORY_EXPORT_MAX_ROWS)
    .map(toAdvisoryCsvRow);
  const header = ADVISORY_EXPORT_COLUMNS.join(',');
  const body = rows
    .map((row) => ADVISORY_EXPORT_COLUMNS.map((col) => advisoryCsvEscape(row[col])).join(','))
    .join('\n');
  return { header, body, count: rows.length };
}

export function downloadAdvisoryCsv(items, filename) {
  const { header, body, count } = buildAdvisoryCsv(items);
  const blob = new Blob(['\uFEFF' + header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return count;
}

export function buildAdvisoryShareLink(symbol) {
  const clean = String(symbol || '').trim().toUpperCase();
  return `/ai-advisory${clean ? `?symbol=${encodeURIComponent(clean)}` : ''}`;
}

export async function copyAdvisoryShareLink(symbol) {
  const link = buildAdvisoryShareLink(symbol);
  const absolute = typeof window !== 'undefined' && window.location?.origin
    ? `${window.location.origin}${link}`
    : link;
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(absolute);
    return absolute;
  }
  throw new Error('clipboard-unavailable');
}
