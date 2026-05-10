import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../context/LangContext';
import { alertCardTone, alertSeveritySummaryTone, normalizeAlertSeverity } from '../utils/alertTaxonomy';

function severityLabel(severity, t) {
  const normalized = normalizeAlertSeverity(severity, 'medium');
  if (normalized === 'critical') {
    return t('dashboardRealtime.severityCritical', { defaultValue: 'Nghiêm trọng' });
  }
  if (normalized === 'high') {
    return t('dashboardRealtime.severityHigh', { defaultValue: 'Cao' });
  }
  if (normalized === 'low') {
    return t('dashboardRealtime.severityLow', { defaultValue: 'Thấp' });
  }
  return t('dashboardRealtime.severityMedium', { defaultValue: 'Trung bình' });
}

function timeLabel(value, formatTime, t) {
  if (!value) {
    return t('dashboardRealtime.stickyAlertBarMissingTime', { defaultValue: '—' });
  }

  return formatTime(value, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function StickyAlertBar({
  alerts = [],
  className = '',
  viewAllHref = '/whale-alerts',
}) {
  const { t, formatTime } = useI18n();

  const normalizeSymbol = (s) => String(s || '').trim().toUpperCase();
  
  // Deduplicate alerts by symbol to ensure variety in the top 3
  const topAlerts = React.useMemo(() => {
    const uniqueSymbols = new Set();
    const result = [];
    const sourceAlerts = Array.isArray(alerts) ? alerts : [];
    
    for (const alert of sourceAlerts) {
      const symbol = normalizeSymbol(alert.symbol);
      if (!uniqueSymbols.has(symbol)) {
        uniqueSymbols.add(symbol);
        result.push(alert);
      }
      if (result.length >= 3) break;
    }
    return result;
  }, [alerts]);

  return (
    <section
      data-testid="sticky-alert-bar"
      className={`sticky top-0 z-20 mb-6 rounded-2xl border border-slate-800/80 bg-slate-950/90 py-2 shadow-[0_18px_48px_rgba(15,23,42,0.42)] backdrop-blur ${className}`.trim()}
    >
      <div className="flex items-center justify-end px-4">
        <Link to={viewAllHref} className="text-[10px] font-bold uppercase tracking-wider text-cyan-500/80 transition-colors hover:text-cyan-400">
          {t('dashboardRealtime.viewAll')} →
        </Link>
      </div>

      {topAlerts.length === 0 ? (
        <div className="mt-1.5 rounded-xl border border-slate-800/70 bg-slate-900/70 px-3 py-2 text-sm text-slate-400 text-center">
          {t('dashboardRealtime.stickyAlertBarEmpty', { defaultValue: 'Chưa có cảnh báo đủ mạnh để ghim.' })}
        </div>
      ) : (
        <div className="mt-1 grid grid-cols-1 gap-6 md:grid-cols-3">
          {topAlerts.map((alert, index) => {
            const severity = normalizeAlertSeverity(alert.severity, 'medium');
            const severityTone = alertSeveritySummaryTone(severity);
            const cardTone = alertCardTone(alert.type, severity);
            const symbol = String(alert.symbol || 'N/A').trim() || 'N/A';
            const targetHref = alert.to || `/stocks/${symbol}`;
            const displayTime = timeLabel(alert.ts, formatTime, t);

            return (
              <Link
                key={alert.id || `${symbol}-${alert.ts || index}`}
                to={targetHref}
                aria-label={`${symbol} ${severityLabel(severity, t)} ${displayTime}`}
                className="block"
              >
                <div className={`flex h-full flex-col justify-between rounded-xl border px-3 py-2.5 transition-all duration-150 hover:-translate-y-[1px] hover:brightness-110 ${cardTone}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">
                        {t('dashboardRealtime.stickyAlertSymbolLabel', { defaultValue: 'Mã' })}
                      </p>
                      <p className="truncate text-[18px] font-black leading-none text-white">
                        {symbol}
                      </p>
                    </div>

                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${severityTone}`}>
                      {severityLabel(severity, t)}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-white/70">
                    <span className="truncate">
                      {displayTime}
                    </span>
                    <span className="text-white/50">→</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}