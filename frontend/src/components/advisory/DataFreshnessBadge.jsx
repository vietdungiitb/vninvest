import React, { useEffect, useState } from 'react';
import { useI18n } from '../../context/LangContext';

/**
 * S24-07 — DataFreshnessBadge
 *
 * Shows how old the last realtime event was with colour-coded urgency.
 *
 * Props:
 *   lastEventAt   – ISO timestamp of the most recent realtime event, or null
 *   realtimeStatus – 'live' | 'polling' | 'connecting' | 'idle'
 *   compact       – boolean: show minimal chip only (no label)
 */
export default function DataFreshnessBadge({ lastEventAt, realtimeStatus = 'idle', compact = false }) {
  const { t, formatTime } = useI18n();
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

  // Determine badge style
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
    ? t('freshness.unknown', { defaultValue: 'Chưa nhận' })
    : secondsAgo < 60
      ? t('freshness.secondsAgo', { value: secondsAgo, defaultValue: `${secondsAgo}s trước` })
      : t('freshness.minutesAgo', { value: Math.floor(secondsAgo / 60), defaultValue: `${Math.floor(secondsAgo / 60)}m trước` });

  const statusLabel = {
    live: t('freshness.statusLive', { defaultValue: 'Live' }),
    polling: t('freshness.statusPolling', { defaultValue: 'Polling' }),
    connecting: t('freshness.statusConnecting', { defaultValue: 'Đang kết nối' }),
    idle: t('freshness.statusIdle', { defaultValue: 'Ngoại tuyến' }),
  }[realtimeStatus] || realtimeStatus;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${colorClass}`}>
        <span className={`w-1.5 h-1.5 rounded-full inline-block ${dotClass}`} />
        {formattedAge}
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${colorClass}`}>
      <span className={`w-2 h-2 rounded-full inline-block flex-shrink-0 ${dotClass}`} />
      <span>
        <span className="font-medium">{statusLabel}</span>
        {secondsAgo != null && (
          <span className="ml-1 opacity-75">· {formattedAge}</span>
        )}
        {lastEventAt && !compact && (
          <span className="ml-1 opacity-50">({formatTime(lastEventAt)})</span>
        )}
      </span>
    </div>
  );
}
