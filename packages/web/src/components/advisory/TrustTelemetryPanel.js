/**
 * TrustTelemetryPanel — Trust telemetry panel for Whale Advisory
 * Converted from JSX to createElement pattern
 */
import { createElement, useCallback, useEffect, useState } from 'react';

const e = createElement;

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

function getEventLabel(eventKey) {
  return ({
    recommendation_explainability_opened: 'Mở giải thích',
    recommendation_explainability_insufficient: 'Thiếu giải thích',
    recommendation_risk_mode_changed: 'Đổi khẩu vị rủi ro',
    recommendation_action_checklist_completed: 'Checklist hoàn tất',
    recommendation_action_attempt_blocked: 'Hành động bị chặn',
    recommendation_history_opened: 'Mở lịch sử',
  })[eventKey] || eventKey;
}

function safeParse(raw, fallback) {
  try {
    return JSON.parse(raw || '');
  } catch (_err) {
    return fallback;
  }
}

export function TrustTelemetryPanel() {
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

  function fmtDateTime(ts) {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString();
    } catch {
      return '—';
    }
  }

  return e(
    'div',
    { className: 'rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3' },
    e(
      'div',
      { className: 'flex items-center justify-between gap-3' },
      e('p', { className: 'text-xs font-semibold uppercase tracking-wider text-slate-400' }, 'Trust Telemetry'),
      e('button', {
        type: 'button',
        onClick: reload,
        className: 'text-[11px] px-2 py-1 rounded border border-slate-700 text-slate-300 hover:bg-slate-800'
      }, 'Làm mới')
    ),
    e(
      'div',
      { className: 'grid grid-cols-2 md:grid-cols-3 gap-2' },
      e(
        'div',
        { className: 'rounded border border-slate-800 bg-slate-950/40 px-3 py-2' },
        e('p', { className: 'text-[11px] text-slate-500' }, 'Tổng events'),
        e('p', { className: 'text-sm font-semibold text-slate-100' }, totalEvents)
      ),
      EVENT_KEYS.map((key) => e(
        'div',
        { key: key, className: 'rounded border border-slate-800 bg-slate-950/40 px-3 py-2' },
        e('p', { className: 'text-[11px] text-slate-500 truncate', title: getEventLabel(key) }, getEventLabel(key)),
        e('p', { className: 'text-sm font-semibold text-slate-100' }, Number(counters[key] || 0))
      ))
    ),
    e(
      'div',
      { className: 'rounded border border-slate-800 bg-slate-950/40 p-3' },
      e('p', { className: 'text-[11px] text-slate-500 mb-2' }, 'Sự kiện gần nhất'),
      recentEvents.length === 0 ? e('p', { className: 'text-xs text-slate-600' }, 'Chưa có telemetry event.') : e(
        'ul',
        { className: 'space-y-1.5 max-h-40 overflow-y-auto' },
        recentEvents.map((item, idx) => e(
          'li',
          { key: `${item?.ts || idx}`, className: 'text-[11px] text-slate-300 flex items-start justify-between gap-3' },
          e('span', { className: 'truncate' }, getEventLabel(item?.event)),
          e('span', { className: 'text-slate-500 shrink-0' }, fmtDateTime(item?.ts))
        ))
      )
    )
  );
}

export default TrustTelemetryPanel;