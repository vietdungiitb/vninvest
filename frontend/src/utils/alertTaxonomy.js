const ALERT_TYPE_VALUES = new Set(['buy', 'sell', 'flow', 'neutral']);

export function normalizeAlertSeverity(value, fallback = 'medium') {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'critical' || normalized === 'extreme') return 'critical';
  if (normalized === 'high') return 'high';
  if (normalized === 'medium') return 'medium';
  if (normalized === 'low') return 'low';
  return fallback;
}

export function severityWeight(severity) {
  if (severity === 'critical') return 4;
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}

export function normalizeAlertType(value, fallback = 'neutral') {
  const normalized = String(value || '').toLowerCase();
  if (ALERT_TYPE_VALUES.has(normalized)) return normalized;
  return fallback;
}

export function deriveAlertType({ source, side, headline, changePct }) {
  const normalizedSide = String(side || '').toLowerCase();
  if (normalizedSide === 'buy') return 'buy';
  if (normalizedSide === 'sell') return 'sell';

  const normalizedSource = String(source || '').toLowerCase();
  if (normalizedSource === 'dark_flow') return 'flow';
  if (normalizedSource === 'stale_quote') return 'neutral';

  const pct = Number(changePct);
  if (normalizedSource === 'price_shock' && Number.isFinite(pct)) {
    return pct >= 0 ? 'buy' : 'sell';
  }

  const normalizedHeadline = String(headline || '').trim().toLowerCase();
  if (/(\bbuy\b|\bmua\b|upside|price jump|tang)/i.test(normalizedHeadline)) return 'buy';
  if (/(\bsell\b|\bban\b|downside|price drop|giam)/i.test(normalizedHeadline)) return 'sell';
  if (/(flow|dark money|dong tien|dòng tiền)/i.test(normalizedHeadline)) return 'flow';

  if (normalizedSource === 'whale') return 'buy';
  return 'neutral';
}

export function alertCardTone(type, severity) {
  const normalizedType = normalizeAlertType(type);
  const normalizedSeverity = normalizeAlertSeverity(severity);

  const baseMap = {
    buy: {
      critical: 'border-emerald-400/80 bg-emerald-950/45 text-emerald-100 shadow-[0_0_0_1px_rgba(74,222,128,0.25),0_0_18px_rgba(16,185,129,0.35)]',
      high: 'border-emerald-500/70 bg-emerald-950/35 text-emerald-100 shadow-[0_0_0_1px_rgba(16,185,129,0.2),0_0_12px_rgba(16,185,129,0.22)]',
      medium: 'border-emerald-700/70 bg-emerald-950/26 text-emerald-200',
      low: 'border-emerald-900/80 bg-emerald-950/18 text-emerald-300',
    },
    sell: {
      critical: 'border-rose-400/80 bg-rose-950/45 text-rose-100 shadow-[0_0_0_1px_rgba(251,113,133,0.28),0_0_18px_rgba(225,29,72,0.32)]',
      high: 'border-rose-500/70 bg-rose-950/35 text-rose-100 shadow-[0_0_0_1px_rgba(244,63,94,0.2),0_0_12px_rgba(225,29,72,0.2)]',
      medium: 'border-rose-700/70 bg-rose-950/26 text-rose-200',
      low: 'border-rose-900/80 bg-rose-950/18 text-rose-300',
    },
    flow: {
      critical: 'border-violet-400/80 bg-violet-950/45 text-violet-100 shadow-[0_0_0_1px_rgba(167,139,250,0.28),0_0_18px_rgba(124,58,237,0.32)]',
      high: 'border-violet-500/70 bg-violet-950/35 text-violet-100 shadow-[0_0_0_1px_rgba(139,92,246,0.22),0_0_12px_rgba(124,58,237,0.2)]',
      medium: 'border-violet-700/70 bg-violet-950/26 text-violet-200',
      low: 'border-violet-900/80 bg-violet-950/18 text-violet-300',
    },
    neutral: {
      critical: 'border-slate-500/80 bg-slate-900/80 text-slate-100',
      high: 'border-slate-600/80 bg-slate-900/75 text-slate-200',
      medium: 'border-slate-700 bg-slate-900/70 text-slate-300',
      low: 'border-slate-800 bg-slate-950 text-slate-400',
    },
  };

  return baseMap[normalizedType][normalizedSeverity];
}

export function alertTypeBadgeTone(type) {
  const normalizedType = normalizeAlertType(type);
  if (normalizedType === 'buy') return 'border-emerald-700/70 bg-emerald-950/35 text-emerald-200';
  if (normalizedType === 'sell') return 'border-rose-700/70 bg-rose-950/35 text-rose-200';
  if (normalizedType === 'flow') return 'border-violet-700/70 bg-violet-950/35 text-violet-200';
  return 'border-slate-700 bg-slate-900 text-slate-300';
}

export function alertSourceBadgeTone(source) {
  if (source === 'whale') return 'border-cyan-700/80 bg-cyan-950/40 text-cyan-200';
  if (source === 'dark_flow') return 'border-violet-700/80 bg-violet-950/35 text-violet-200';
  if (source === 'price_shock') return 'border-amber-700/80 bg-amber-950/35 text-amber-200';
  return 'border-slate-700 bg-slate-900 text-slate-300';
}

export function alertSeveritySummaryTone(severity) {
  const normalizedSeverity = normalizeAlertSeverity(severity, 'low');
  if (normalizedSeverity === 'critical') return 'border-rose-700/70 bg-rose-950/35 text-rose-200';
  if (normalizedSeverity === 'high') return 'border-amber-700/70 bg-amber-950/30 text-amber-200';
  if (normalizedSeverity === 'medium') return 'border-cyan-700/70 bg-cyan-950/25 text-cyan-200';
  return 'border-slate-700 bg-slate-900 text-slate-300';
}

export function alertTypeLabel(type, t) {
  const normalizedType = normalizeAlertType(type);
  if (normalizedType === 'buy') return t('dashboardRealtime.typeBuy');
  if (normalizedType === 'sell') return t('dashboardRealtime.typeSell');
  if (normalizedType === 'flow') return t('dashboardRealtime.typeFlow');
  return t('dashboardRealtime.typeNeutral');
}
