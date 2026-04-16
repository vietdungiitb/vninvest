import React, { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../context/LangContext';

const COUNTER_KEY = 'vninvest:trust-telemetry-counters';
const LOG_KEY = 'vninvest:trust-telemetry-log';

const EVENT_KEYS = [
  'recommendation_explainability_opened',
  'recommendation_explainability_insufficient',
  'recommendation_risk_mode_changed',
  'recommendation_action_checklist_completed',
  'recommendation_action_attempt_blocked',
  'recommendation_history_opened',
];

function getEventLabel(t, eventKey) {
  return t(`trustTelemetry.events.${eventKey}`, { defaultValue: eventKey });
}

function safeParse(raw, fallback) {
  try {
    return JSON.parse(raw || '');
  } catch (_err) {
    return fallback;
  }
}

export default function TrustTelemetryPanel() {
  const { t, formatDateTime } = useI18n();
  const [counters, setCounters] = useState({});
  const [recentEvents, setRecentEvents] = useState([]);

  const reload = useCallback(() => {
    const nextCounters = safeParse(localStorage.getItem(COUNTER_KEY), {});
    const nextLog = safeParse(localStorage.getItem(LOG_KEY), []);
    setCounters(nextCounters || {});
    setRecentEvents(Array.isArray(nextLog) ? nextLog.slice(-8).reverse() : []);
  }, []);

  useEffect(() => {
    reload();
    const onEvent = () => reload();
    window.addEventListener('vninvest:trust_telemetry', onEvent);
    return () => window.removeEventListener('vninvest:trust_telemetry', onEvent);
  }, [reload]);

  const totalEvents = EVENT_KEYS.reduce((acc, key) => acc + Number(counters[key] || 0), 0);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {t('trustTelemetry.title', { defaultValue: 'Trust Telemetry' })}
        </p>
        <button
          type="button"
          onClick={reload}
          className="text-[11px] px-2 py-1 rounded border border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          {t('trustTelemetry.refresh', { defaultValue: 'Làm mới' })}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <div className="rounded border border-slate-800 bg-slate-950/40 px-3 py-2">
          <p className="text-[11px] text-slate-500">{t('trustTelemetry.total', { defaultValue: 'Tổng events' })}</p>
          <p className="text-sm font-semibold text-slate-100">{totalEvents}</p>
        </div>
        {EVENT_KEYS.map((key) => (
          <div key={key} className="rounded border border-slate-800 bg-slate-950/40 px-3 py-2">
            <p className="text-[11px] text-slate-500 truncate" title={getEventLabel(t, key)}>{getEventLabel(t, key)}</p>
            <p className="text-sm font-semibold text-slate-100">{Number(counters[key] || 0)}</p>
          </div>
        ))}
      </div>

      <div className="rounded border border-slate-800 bg-slate-950/40 p-3">
        <p className="text-[11px] text-slate-500 mb-2">{t('trustTelemetry.recent', { defaultValue: 'Sự kiện gần nhất' })}</p>
        {recentEvents.length === 0 ? (
          <p className="text-xs text-slate-600">{t('trustTelemetry.empty', { defaultValue: 'Chưa có telemetry event.' })}</p>
        ) : (
          <ul className="space-y-1.5 max-h-40 overflow-y-auto">
            {recentEvents.map((item, idx) => {
              const eventLabel = item && item.event ? getEventLabel(t, item.event) : '—';
              return (
                <li key={`${item?.ts || idx}`} className="text-[11px] text-slate-300 flex items-start justify-between gap-3">
                  <span className="truncate">{eventLabel}</span>
                  <span className="text-slate-500 shrink-0">{item?.ts ? formatDateTime(item.ts, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
