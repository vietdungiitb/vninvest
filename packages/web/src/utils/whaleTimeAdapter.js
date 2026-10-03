/**
 * utils/whaleTimeAdapter.js
 * 
 * Canonical time normalization for Whale Analytics.
 * Ensures ECharts analytics panes stay in sync and respect market session windows.
 */

const MORNING_START = { hour: 9, minute: 0 };
const MORNING_END = { hour: 11, minute: 30 };
const AFTERNOON_START = { hour: 13, minute: 0 };
const SESSION_END = { hour: 15, minute: 0 };

const ROLLING_WINDOW_MINUTES = {
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1h': 60,
};

function buildClockDate(referenceDate, hour, minute) {
  const anchor = referenceDate instanceof Date ? new Date(referenceDate) : new Date(referenceDate || Date.now());
  anchor.setHours(hour, minute, 0, 0);
  return anchor;
}

function cloneAtMinute(date) {
  const cloned = new Date(date);
  cloned.setSeconds(0, 0);
  return cloned;
}

export function getMarketSessionSegments(referenceDate = new Date()) {
  return [
    {
      key: 'morning',
      start: buildClockDate(referenceDate, MORNING_START.hour, MORNING_START.minute),
      end: buildClockDate(referenceDate, MORNING_END.hour, MORNING_END.minute),
    },
    {
      key: 'afternoon',
      start: buildClockDate(referenceDate, AFTERNOON_START.hour, AFTERNOON_START.minute),
      end: buildClockDate(referenceDate, SESSION_END.hour, SESSION_END.minute),
    },
  ];
}

export function getEffectiveMarketNow(referenceDate = new Date()) {
  const now = cloneAtMinute(referenceDate instanceof Date ? referenceDate : new Date(referenceDate));
  const [morning, afternoon] = getMarketSessionSegments(now);

  if (now <= morning.start) {
    return cloneAtMinute(morning.start);
  }

  if (now >= morning.start && now <= morning.end) {
    return now;
  }

  if (now > morning.end && now < afternoon.start) {
    return cloneAtMinute(morning.end);
  }

  if (now >= afternoon.start && now <= afternoon.end) {
    return now;
  }

  return cloneAtMinute(afternoon.end);
}

export function isWithinMarketSession(epochSeconds, referenceDate = new Date()) {
  if (!Number.isFinite(Number(epochSeconds))) {
    return false;
  }
  // Date-agnostic: check time-of-day in VN timezone (UTC+7) only.
  // This ensures historical data from previous sessions is not filtered out.
  const vnOffsetSeconds = 7 * 3600;
  const secondsInDay = Number(epochSeconds) + vnOffsetSeconds;
  const vnTimeMinutes = Math.floor((secondsInDay % 86400) / 60);
  const morningStart = 9 * 60 + 0;    // 09:00
  const morningEnd   = 11 * 60 + 30;  // 11:30
  const afternoonStart = 13 * 60 + 0; // 13:00
  const sessionEnd     = 15 * 60 + 0; // 15:00
  return (vnTimeMinutes >= morningStart && vnTimeMinutes <= morningEnd) ||
         (vnTimeMinutes >= afternoonStart && vnTimeMinutes <= sessionEnd);
}

export function subtractTradingMinutes(referenceDate, minutes) {
  let remainingMinutes = Math.max(0, Number(minutes) || 0);
  let cursor = cloneAtMinute(referenceDate instanceof Date ? referenceDate : new Date(referenceDate));
  const segments = getMarketSessionSegments(cursor);

  while (remainingMinutes > 0) {
    const activeSegment = segments.find((segment) => cursor >= segment.start && cursor <= segment.end);

    if (activeSegment) {
      const minutesAvailable = Math.floor((cursor.getTime() - activeSegment.start.getTime()) / 60000);
      if (minutesAvailable >= remainingMinutes) {
        return new Date(cursor.getTime() - remainingMinutes * 60000);
      }

      remainingMinutes -= minutesAvailable;
      cursor = cloneAtMinute(new Date(activeSegment.start.getTime()));
    }

    if (cursor > segments[1].start) {
      cursor = cloneAtMinute(segments[0].end);
      continue;
    }

    if (cursor > segments[0].start) {
      const minutesAvailable = Math.floor((cursor.getTime() - segments[0].start.getTime()) / 60000);
      if (minutesAvailable >= remainingMinutes) {
        return new Date(cursor.getTime() - remainingMinutes * 60000);
      }

      remainingMinutes -= minutesAvailable;
      return cloneAtMinute(segments[0].start);
    }

    return cloneAtMinute(segments[0].start);
  }

  return cursor;
}

export function resolveWhaleTimeframeWindow(timeframe, referenceDate = new Date()) {
  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const effectiveNow = getEffectiveMarketNow(now);
  const [morning, afternoon] = getMarketSessionSegments(now);
  const normalizedTimeframe = String(timeframe || 'session').trim().toLowerCase();

  let startDate = morning.start;
  let endDate = effectiveNow;

  if (normalizedTimeframe === 'morning') {
    startDate = morning.start;
    endDate = effectiveNow < morning.start
      ? morning.start
      : (effectiveNow <= morning.end ? effectiveNow : morning.end);
  } else if (normalizedTimeframe === 'afternoon') {
    startDate = afternoon.start;
    endDate = effectiveNow < afternoon.start
      ? afternoon.start
      : (effectiveNow <= afternoon.end ? effectiveNow : afternoon.end);
  } else if (normalizedTimeframe === 'session') {
    startDate = morning.start;
    endDate = effectiveNow;
  } else if (ROLLING_WINDOW_MINUTES[normalizedTimeframe]) {
    endDate = effectiveNow;
    startDate = subtractTradingMinutes(endDate, ROLLING_WINDOW_MINUTES[normalizedTimeframe]);
  }

  const safeStart = cloneAtMinute(startDate);
  const safeEnd = cloneAtMinute(endDate < safeStart ? safeStart : endDate);

  return {
    timeframe: normalizedTimeframe,
    startEpochSec: Math.floor(safeStart.getTime() / 1000),
    endEpochSec: Math.floor(safeEnd.getTime() / 1000),
    startMs: safeStart.getTime(),
    endMs: safeEnd.getTime(),
    isLive: (now >= morning.start && now <= morning.end) || (now >= afternoon.start && now <= afternoon.end),
    sessionSegments: [
      {
        key: 'morning',
        startMs: morning.start.getTime(),
        endMs: morning.end.getTime(),
      },
      {
        key: 'afternoon',
        startMs: afternoon.start.getTime(),
        endMs: afternoon.end.getTime(),
      },
    ],
  };
}

/**
 * Normalizes any timestamp/date string into a canonical minute bucket (epoch seconds).
 * Useful for mapping data points to a shared grid.
 * 
 * @param {string|number|Date} ts - The timestamp to normalize
 * @returns {number|null} - Epoch seconds at the start of the minute, or null if invalid
 */
export function toCanonicalMinute(ts) {
  if (!ts) return null;
  
  let date;
  if (ts instanceof Date) {
    date = ts;
  } else if (typeof ts === 'number') {
    // Assume seconds if < 1e11, else milliseconds
    date = new Date(ts < 1e11 ? ts * 1000 : ts);
  } else if (typeof ts === 'string') {
    const trimmed = ts.trim();
    const numericTs = Number(trimmed);

    if (trimmed !== '' && Number.isFinite(numericTs)) {
      // Accept both epoch seconds and epoch milliseconds represented as strings.
      date = new Date(numericTs < 1e11 ? numericTs * 1000 : numericTs);
    } else {
      date = new Date(trimmed);
    }
  } else {
    date = new Date(ts);
  }
  
  if (isNaN(date.getTime())) return null;
  
  // Strip seconds and milliseconds
  const canonical = new Date(date);
  canonical.setSeconds(0);
  canonical.setMilliseconds(0);
  
  return Math.floor(canonical.getTime() / 1000);
}

/**
 * Formats canonical minute for display (HH:mm)
 */
export function formatMinuteLabel(epochSeconds) {
  if (!epochSeconds) return '';
  const d = new Date(epochSeconds * 1000);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
