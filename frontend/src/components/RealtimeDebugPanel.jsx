import React, { useEffect, useState } from 'react';
import { useI18n } from '../context/LangContext';
import useRealtimeFeed from '../hooks/useRealtimeFeed';

function formatSeverity(severity) {
  return typeof severity === 'string' ? severity.toUpperCase() : '—';
}

export default function RealtimeDebugPanel() {
  const { t, formatNumber, formatTime } = useI18n();
  const urlParams = new URLSearchParams(window.location.search);
  const debugParam = urlParams.get('debug');
  if (debugParam !== 'realtime') return null;

  // Use hook with empty symbols to get global metrics (not symbol-specific)
  const { realtimeStatus, lastEventAt, alerts, metrics, latestWhaleAlert, latestDarkFlowAlert } = useRealtimeFeed({ 
    symbols: [], 
    pollInterval: 30000, 
    maxAlerts: 5 
  });

  const [isOpen, setIsOpen] = useState(true);
  const [recentEvents, setRecentEvents] = useState([]);

  useEffect(() => {
    // Log recent events (mock timeline - in real use a ref queue)
    const event = {
      ts: formatTime(new Date()),
      type: realtimeStatus === 'live' ? 'live' : realtimeStatus,
      latency: metrics.lastLatencyMs?.toFixed(0) + 'ms',
      alerts: alerts.length
    };
    setRecentEvents(prev => [event, ...prev].slice(0, 5));
  }, [alerts.length, formatTime, metrics.lastLatencyMs, realtimeStatus]);

  const connectionState = metrics.connectionState || {};

  if (!isOpen) return null;

  const statusColor = 
    realtimeStatus === 'live' ? 'bg-emerald-500' :
    realtimeStatus === 'connecting' ? 'bg-amber-500' :
    realtimeStatus === 'polling' ? 'bg-blue-500' : 'bg-gray-500';

  const eventTypeLabel = {
    live: t('realtimeDebug.eventType.live'),
    connecting: t('realtimeDebug.eventType.connecting'),
    polling: t('realtimeDebug.eventType.polling'),
    disconnected: t('realtimeDebug.eventType.disconnected'),
    idle: t('realtimeDebug.eventType.idle'),
  };

  const formatValue = (value, options) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return '—';
    }
    return formatNumber(value, options);
  };

  const formatClock = (value) => (value ? formatTime(new Date(value)) : '—');

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-96 bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl p-4 text-xs font-mono text-gray-200 max-h-96 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-700">
        <span className="font-semibold text-emerald-400">{t('realtimeDebug.title')}</span>
        <button 
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-200 transition-colors p-0.5 rounded"
        >
          ×
        </button>
      </div>

      {/* Status */}
      <div className="mb-3">
        <span className="font-medium text-gray-300">{t('realtimeDebug.statusLabel')}</span>
        <span className={`ml-2 px-2 py-0.5 rounded-full ${statusColor} text-white font-mono`}>
          {realtimeStatus.toUpperCase()}
        </span>
        {lastEventAt && (
          <div className="text-gray-500 mt-1 text-[10px]">
            {t('realtimeDebug.lastEvent', { time: formatTime(new Date(lastEventAt)) })}
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="mb-3 grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <span className="text-gray-400">{t('realtimeDebug.metrics.ticker')}</span> {metrics.eventCounts.ticker_update}
        </div>
        <div>
          <span className="text-gray-400">{t('realtimeDebug.metrics.whale')}</span> {metrics.eventCounts.whale_alert}
        </div>
        <div>
          <span className="text-gray-400">{t('realtimeDebug.metrics.darkFlow')}</span> {metrics.eventCounts.dark_flow_alert}
        </div>
        <div>
          <span className="text-gray-400">{t('realtimeDebug.metrics.heartbeat')}</span> {metrics.eventCounts.heartbeat}
        </div>
        <div>
          <span className="text-gray-400">{t('realtimeDebug.metrics.reconnects')}</span> {metrics.eventCounts.reconnect_attempts}
        </div>
        <div>
          <span className="text-gray-400">{t('realtimeDebug.metrics.subscribed')}</span> {metrics.eventCounts.subscribed}
        </div>
        <div>
          <span className="text-gray-400">{t('realtimeDebug.metrics.unsubscribed')}</span> {metrics.eventCounts.unsubscribed}
        </div>
        <div>
          <span className="text-gray-400">{t('realtimeDebug.metrics.pollOk')}</span> {metrics.eventCounts.polling_successes}
        </div>
        <div>
          <span className="text-gray-400">{t('realtimeDebug.metrics.pollFail')}</span> {metrics.eventCounts.polling_failures}
        </div>
        {metrics.lastLatencyMs && (
          <div className="col-span-2">
            <span className="text-gray-400">{t('realtimeDebug.metrics.latency')}</span> {metrics.lastLatencyMs.toFixed(0)}ms
          </div>
        )}
      </div>

      {/* Alerts */}
      {latestWhaleAlert && (
        <div className="mb-3 p-2 bg-rose-500/20 border border-rose-500/50 rounded text-[11px]">
          <div>
            <span className="font-medium">{t('realtimeDebug.latestWhale')}</span> {latestWhaleAlert.symbol} {latestWhaleAlert.side} {formatValue(latestWhaleAlert.matched_value)}đ
          </div>
          <div className="mt-1 text-gray-300">
            {t('realtimeDebug.whaleSeverity')} {formatSeverity(latestWhaleAlert.severity)} | {t('realtimeDebug.whaleDisplay')} {latestWhaleAlert.display_score ?? '—'} | {t('realtimeDebug.whaleEvent')} {latestWhaleAlert.event_score ?? '—'}
          </div>
          <div className="mt-1 text-gray-400">
            {t('realtimeDebug.weights')} {latestWhaleAlert.weights_version ?? '—'}
          </div>
          <div className="mt-1 text-gray-400">
            {t('realtimeDebug.config')} {latestWhaleAlert.config_version ?? '—'} | {t('realtimeDebug.source')} {latestWhaleAlert.source ?? '—'}
          </div>
          <div className="mt-1 break-all text-gray-500">
            {t('realtimeDebug.eventId')} {latestWhaleAlert.event_id ?? '—'}
          </div>
        </div>
      )}

      {/* Dark Flow Alert */}
      {latestDarkFlowAlert && (
        <div className="mb-3 p-2 bg-violet-500/20 border border-violet-500/50 rounded text-[11px]">
          <div>
            <span className="font-medium">{t('realtimeDebug.latestDarkFlow')}</span> {latestDarkFlowAlert.symbol} — {latestDarkFlowAlert.signal_type}
          </div>
          <div className="mt-1 text-gray-300">
            {t('realtimeDebug.strength')} {latestDarkFlowAlert.strength?.toFixed(1) ?? '—'} | {t('realtimeDebug.confidence')} {latestDarkFlowAlert.confidence ?? '—'}
          </div>
          <div className="mt-1 text-gray-400">
            {t('realtimeDebug.tickRate')} {latestDarkFlowAlert.tick_rate ?? '—'}/min | {t('realtimeDebug.smallRatio')} {latestDarkFlowAlert.small_order_ratio != null ? `${latestDarkFlowAlert.small_order_ratio * 100}%` : '—'}
          </div>
          <div className="mt-1 break-all text-gray-500">
            {t('realtimeDebug.eventId')} {latestDarkFlowAlert.event_id ?? '—'}
          </div>
        </div>
      )}

      <div className="mb-3 rounded border border-gray-800 bg-gray-950/60 p-2 text-[10px] text-gray-400">
        <div>{t('realtimeDebug.connection.transport')} {connectionState.transport || '—'}</div>
        <div>{t('realtimeDebug.connection.closeCode')} {connectionState.lastCloseCode ?? '—'}</div>
        <div>{t('realtimeDebug.connection.closeReason')} {connectionState.lastCloseReason || '—'}</div>
        <div>{t('realtimeDebug.connection.lastSubscribed')} {formatClock(connectionState.lastSubscribedAt)}</div>
        <div>{t('realtimeDebug.connection.lastUnsubscribed')} {formatClock(connectionState.lastUnsubscribedAt)}</div>
        <div>{t('realtimeDebug.connection.lastReconnect')} {formatClock(connectionState.lastReconnectAt)}</div>
        <div>{t('realtimeDebug.connection.lastError')} {formatClock(connectionState.lastErrorAt)}</div>
        <div>{t('realtimeDebug.connection.symbols')} {(connectionState.subscribedSymbols || []).join(', ') || '—'}</div>
      </div>

      {/* Timeline */}
      <div className="mb-2">
        <span className="font-medium text-gray-300 block mb-1">{t('realtimeDebug.timelineTitle')}</span>
        {recentEvents.map((event, i) => (
          <div key={i} className="text-[10px] text-gray-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-500 flex-shrink-0"></span>
            {event.ts} {eventTypeLabel[event.type] || event.type} {event.latency} ({t('realtimeDebug.alertCount', { count: event.alerts })})
          </div>
        ))}
      </div>

      {/* Toggle */}
      <div className="text-[10px] text-gray-500 text-center pt-1 border-t border-gray-700">
        ?debug=realtime | <button onClick={() => window.location.reload()} className="underline hover:text-gray-300">{t('realtimeDebug.reload')}</button>
      </div>
    </div>
  );
}

