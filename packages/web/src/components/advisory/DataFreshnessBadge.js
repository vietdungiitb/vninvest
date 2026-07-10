/**
 * DataFreshnessBadge — Data freshness indicator for Whale Advisory
 * Converted from JSX to createElement pattern
 */
import { createElement, useEffect, useState } from 'react';

const e = createElement;

export function DataFreshnessBadge({ lastEventAt, realtimeStatus = 'idle', compact = false }) {
  const [secondsAgo, setSecondsAgo] = useState(null);

  useEffect(() => {
    if (!lastEventAt) {
      setSecondsAgo(null);
      return;
    }
    function update() {
      const diff = Math.floor((Date.now() - new Date(lastEventAt).getTime()) / 1000);
      setSecondsAgo(diff >= 0 ? diff : 0);
    }
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [lastEventAt]);

  const { colorClass, dotClass } = (() => {
    if (realtimeStatus === 'idle' || secondsAgo == null) {
      return { colorClass: 'border-gray-700 bg-gray-900 text-gray-500', dotClass: 'bg-gray-600' };
    }
    if (secondsAgo <= 30) {
      return { colorClass: 'border-emerald-800 bg-emerald-950/30 text-emerald-400', dotClass: 'bg-emerald-400 animate-pulse' };
    }
    if (secondsAgo <= 120) {
      return { colorClass: 'border-amber-700 bg-amber-950/20 text-amber-400', dotClass: 'bg-amber-400' };
    }
    return { colorClass: 'border-red-800 bg-red-950/20 text-red-400', dotClass: 'bg-red-400' };
  })();

  const formattedAge = secondsAgo == null
    ? 'Chưa nhận'
    : secondsAgo < 60
      ? `${secondsAgo}s trước`
      : `${Math.floor(secondsAgo / 60)}m trước`;

  const statusLabel = ({
    live: 'Live',
    polling: 'Polling',
    connecting: 'Đang kết nối',
    idle: 'Ngoại tuyến',
  })[realtimeStatus] || realtimeStatus;

  if (compact) {
    return e(
      'span',
      { className: `inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${colorClass}` },
      e('span', { className: `w-1.5 h-1.5 rounded-full inline-block ${dotClass}` }),
      formattedAge
    );
  }

  return e(
    'div',
    { className: `inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${colorClass}` },
    e('span', { className: `w-2 h-2 rounded-full inline-block flex-shrink-0 ${dotClass}` }),
    e(
      'span',
      null,
      e('span', { className: 'font-medium' }, statusLabel),
      secondsAgo != null && e('span', { className: 'ml-1 opacity-75' }, `· ${formattedAge}`),
      lastEventAt && !compact && e('span', { className: 'ml-1 opacity-50' }, `(${new Date(lastEventAt).toLocaleTimeString()})`)
    )
  );
}

export default DataFreshnessBadge;