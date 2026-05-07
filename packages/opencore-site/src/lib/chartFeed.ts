import type { AllowedTimeframe } from './validation';
import { normalizeSymbol } from './validation';

export type ChartBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume?: number;
  sellVolume?: number;
  foreignBuy?: number;
  foreignSell?: number;
  index: number;
  dataIndex: number;
};

export type WhaleEvent = {
  ts: string;
  price: number;
  side: 'BUY' | 'SELL';
  matchedValue: number;
  severity?: 'HIGH' | 'EXTREME';
};

export type ChartFeed = {
  symbol: string;
  timeframe: AllowedTimeframe;
  bars: ChartBar[];
  whale_events: WhaleEvent[];
  session: {
    date: string;
    change_pct: number;
    volume: number;
  };
};

function hashSymbol(symbol: string) {
  return normalizeSymbol(symbol)
    .split('')
    .reduce((accumulator, character) => accumulator + character.charCodeAt(0), 0);
}

export function generateSampleBars(symbol: string, timeframe: AllowedTimeframe, count = 72): ChartBar[] {
  const seed = hashSymbol(symbol) + timeframe.length * 19;
  const bars: ChartBar[] = [];
  let close = 100_000 + seed * 7;
  const start = Date.now() - count * 86_400_000;

  for (let index = 0; index < count; index += 1) {
    const wave = Math.sin((index + seed) / 6) * 1_200;
    const drift = Math.cos((index + seed) / 9) * 320;
    const open = close;
    close = Math.max(1, Math.round(open + wave + drift));
    const high = Math.max(open, close) + Math.round(220 + (index % 5) * 35);
    const low = Math.max(1, Math.min(open, close) - Math.round(180 + (index % 7) * 30));
    const volume = 900_000 + ((seed + index * 137) % 2_700_000);
    const buyVolume = Math.round(volume * (close >= open ? 0.62 : 0.41));
    const sellVolume = volume - buyVolume;

    bars.push({
      date: new Date(start + index * 86_400_000).toISOString(),
      open,
      high,
      low,
      close,
      volume,
      buyVolume,
      sellVolume,
      foreignBuy: Math.round(volume * 0.08),
      foreignSell: Math.round(volume * 0.05),
      index,
      dataIndex: index
    });
  }

  return bars;
}

export function deriveWhaleEvents(bars: readonly ChartBar[]): WhaleEvent[] {
  if (bars.length === 0) {
    return [];
  }

  const volumes = [...bars].map((bar) => bar.volume).sort((left, right) => left - right);
  const threshold = volumes[Math.max(0, Math.floor(volumes.length * 0.9) - 1)] ?? volumes[volumes.length - 1] ?? 0;

  return bars
    .filter((bar) => bar.volume >= threshold)
    .slice(-8)
    .map((bar) => ({
      ts: bar.date,
      price: bar.close,
      side: bar.close >= bar.open ? 'BUY' : 'SELL',
      matchedValue: Math.round(bar.volume * bar.close),
      severity: bar.volume >= threshold * 1.08 ? 'EXTREME' : 'HIGH'
    }));
}

export function buildChartFeed(symbol: string, timeframe: AllowedTimeframe): ChartFeed {
  const bars = generateSampleBars(symbol, timeframe);
  const whaleEvents = deriveWhaleEvents(bars);
  const first = bars[0];
  const last = bars[bars.length - 1];
  const changePct = first ? ((last.close - first.open) / first.open) * 100 : 0;

  return {
    symbol: normalizeSymbol(symbol),
    timeframe,
    bars,
    whale_events: whaleEvents,
    session: {
      date: last?.date ?? new Date().toISOString(),
      change_pct: Number(changePct.toFixed(2)),
      volume: bars.reduce((accumulator, bar) => accumulator + bar.volume, 0)
    }
  };
}
