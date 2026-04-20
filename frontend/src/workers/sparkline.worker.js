/**
 * workers/sparkline.worker.js
 * Web Worker: tính toán SVG polyline points từ mảng giá.
 * Giữ thread chính không bị block khi xử lý nhiều sparklines.
 *
 * Protocol:
 *  Input:  { type: 'COMPUTE', symbols: { [symbol]: number[] } }
 *  Output: { type: 'RESULT',  points:  { [symbol]: string }  }
 *          string = "x1,y1 x2,y2 ..." SVG polyline points attr
 */

const W = 60;
const H = 20;

function computePoints(prices) {
  if (!prices || prices.length < 2) return '';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const step = W / (prices.length - 1);
  return prices
    .map((p, i) => {
      const x = (i * step).toFixed(1);
      const y = (H - ((p - min) / range) * H).toFixed(1);
      return `${x},${y}`;
    })
    .join(' ');
}

self.onmessage = function (event) {
  const { type, symbols } = event.data || {};
  if (type !== 'COMPUTE' || !symbols) return;

  const points = {};
  for (const [symbol, prices] of Object.entries(symbols)) {
    points[symbol] = computePoints(prices);
  }

  self.postMessage({ type: 'RESULT', points });
};
