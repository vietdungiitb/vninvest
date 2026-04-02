import React, { useEffect, useState } from 'react';
import useRealtimeFeed from '../hooks/useRealtimeFeed';

export default function RealtimeDebugPanel() {
  const urlParams = new URLSearchParams(window.location.search);
  const debugParam = urlParams.get('debug');
  if (debugParam !== 'realtime') return null;

  // Use hook with empty symbols to get global metrics (not symbol-specific)
  const { realtimeStatus, lastEventAt, alerts, metrics, latestWhaleAlert } = useRealtimeFeed({ 
    symbols: [], 
    pollInterval: 30000, 
    maxAlerts: 5 
  });

  const [isOpen, setIsOpen] = useState(true);
  const [recentEvents, setRecentEvents] = useState([]);

  useEffect(() => {
    // Log recent events (mock timeline - in real use a ref queue)
    const event = {
      ts: new Date().toLocaleTimeString(),
      type: realtimeStatus === 'live' ? 'live' : realtimeStatus,
      latency: metrics.lastLatencyMs?.toFixed(0) + 'ms',
      alerts: alerts.length
    };
    setRecentEvents(prev => [event, ...prev].slice(0, 5));
  }, [realtimeStatus, metrics.lastLatencyMs, alerts.length]);

  if (!isOpen) return null;

  const statusColor = 
    realtimeStatus === 'live' ? 'bg-emerald-500' :
    realtimeStatus === 'connecting' ? 'bg-amber-500' :
    realtimeStatus === 'polling' ? 'bg-blue-500' : 'bg-gray-500';

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-96 bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl p-4 text-xs font-mono text-gray-200 max-h-96 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-700">
        <span className="font-semibold text-emerald-400">Realtime Debug</span>
        <button 
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-200 transition-colors p-0.5 rounded"
        >
          ×
        </button>
      </div>

      {/* Status */}
      <div className="mb-3">
        <span className="font-medium text-gray-300">Status:</span>
        <span className={`ml-2 px-2 py-0.5 rounded-full ${statusColor} text-white font-mono`}>
          {realtimeStatus.toUpperCase()}
        </span>
        {lastEventAt && (
          <div className="text-gray-500 mt-1 text-[10px]">
            Last event: {new Date(lastEventAt).toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="mb-3 grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <span className="text-gray-400">Ticker:</span> {metrics.eventCounts.ticker_update}
        </div>
        <div>
          <span className="text-gray-400">Whale:</span> {metrics.eventCounts.whale_alert}
        </div>
        <div>
          <span className="text-gray-400">Heartbeat:</span> {metrics.eventCounts.heartbeat}
        </div>
        <div>
          <span className="text-gray-400">Reconnects:</span> {metrics.eventCounts.reconnect_attempts}
        </div>
        {metrics.lastLatencyMs && (
          <div className="col-span-2">
            <span className="text-gray-400">Latency:</span> {metrics.lastLatencyMs.toFixed(0)}ms
          </div>
        )}
      </div>

      {/* Alerts */}
      {latestWhaleAlert && (
        <div className="mb-3 p-2 bg-rose-500/20 border border-rose-500/50 rounded text-[11px]">
          <span className="font-medium">Latest Whale:</span> {latestWhaleAlert.symbol} {latestWhaleAlert.side} 
          {latestWhaleAlert.matched_value?.toLocaleString()}đ
        </div>
      )}

      {/* Timeline */}
      <div className="mb-2">
        <span className="font-medium text-gray-300 block mb-1">Timeline (last 5):</span>
        {recentEvents.map((event, i) => (
          <div key={i} className="text-[10px] text-gray-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-500 flex-shrink-0"></span>
            {event.ts} {event.type} {event.latency} (alerts: {event.alerts})
          </div>
        ))}
      </div>

      {/* Toggle */}
      <div className="text-[10px] text-gray-500 text-center pt-1 border-t border-gray-700">
        ?debug=realtime | <button className="underline hover:text-gray-300">Reload</button>
      </div>
    </div>
  );
}

