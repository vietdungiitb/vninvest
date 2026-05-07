'use client';

const TICKERS = [
  { sym: 'VNM', price: '71.20', change: '+1.81%', up: true },
  { sym: 'VIC', price: '43.50', change: '-0.42%', up: false },
  { sym: 'HPG', price: '28.90', change: '+2.34%', up: true },
  { sym: 'MWG', price: '55.60', change: '+0.72%', up: true },
  { sym: 'TCB', price: '19.80', change: '-0.75%', up: false },
];

const CANDLES = [
  { x: 12, o: 56, h: 59, l: 54, c: 58, up: true },
  { x: 30, o: 58, h: 61, l: 57, c: 60, up: true },
  { x: 48, o: 60, h: 62, l: 56, c: 57, up: false },
  { x: 66, o: 57, h: 60, l: 55, c: 59, up: true },
  { x: 84, o: 59, h: 64, l: 58, c: 63, up: true },
  { x: 102, o: 63, h: 65, l: 60, c: 61, up: false },
  { x: 120, o: 61, h: 66, l: 60, c: 65, up: true },
  { x: 138, o: 65, h: 68, l: 64, c: 67, up: true },
  { x: 156, o: 67, h: 70, l: 65, c: 69, up: true },
  { x: 174, o: 69, h: 72, l: 67, c: 71, up: true },
];

// Map price (54–72) → SVG Y axis (60→4) with 64px height
function priceToY(p: number) {
  return 64 - ((p - 54) / (72 - 54)) * 60;
}

const SPARKLINE = CANDLES
  .map((c) => `${c.x},${priceToY(c.c).toFixed(1)}`)
  .join(' ');

const SPARKFILL = `${CANDLES[0].x},${priceToY(CANDLES[0].c).toFixed(1)} ${SPARKLINE} ${CANDLES[CANDLES.length - 1].x},64 ${CANDLES[0].x},64`;

export function DashboardPreview() {
  return (
    <div className="card overflow-hidden rounded-[2rem] p-[1px]">
      {/* Gradient border shimmer */}
      <div
        className="relative overflow-hidden rounded-[1.95rem]"
        style={{ background: 'linear-gradient(135deg, #0e1a2e 0%, #07111f 100%)' }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <div className="flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-black text-slate-950"
              style={{ background: 'linear-gradient(135deg,#27d5c4,#f6b93b)' }}
            >
              VN
            </div>
            <span className="text-xs font-semibold tracking-[0.18em] text-cyan-200">VNInvest</span>
          </div>
          {/* Live indicator */}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span
                className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
                style={{ animation: 'pulse-ring 1.4s ease-out infinite' }}
              />
              <span className="anim-pulse-dot relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400">Live</span>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {/* Primary ticker */}
          <div
            className="anim-fade-up rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
            style={{ animationDelay: '0.1s' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">VNM · HOSE</div>
                <div className="anim-price-blink mt-0.5 text-xl font-semibold text-white">
                  71.200
                </div>
              </div>
              <div className="text-right">
                <div className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                  ▲ +1.81%
                </div>
                <div className="mt-1 text-[10px] text-slate-500">Vol 2.4M</div>
              </div>
            </div>

            {/* Candlestick chart */}
            <div className="mt-3 overflow-hidden rounded-xl">
              <svg viewBox="0 0 192 68" className="w-full" aria-hidden="true" style={{ height: 68 }}>
                {/* Gradient fill under sparkline */}
                <defs>
                  <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="cg" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity="1" />
                  </linearGradient>
                </defs>

                {/* Fill area */}
                <polygon
                  points={SPARKFILL}
                  fill="url(#sg)"
                  opacity="1"
                  style={{ animation: 'fade-up 1.2s ease 0.3s both' }}
                />

                {/* Candle wicks */}
                {CANDLES.map((c) => (
                  <line
                    key={`w-${c.x}`}
                    x1={c.x}
                    y1={priceToY(c.h)}
                    x2={c.x}
                    y2={priceToY(c.l)}
                    stroke={c.up ? '#34d399' : '#f87171'}
                    strokeWidth="1"
                    opacity="0.6"
                  />
                ))}
                {/* Candle bodies */}
                {CANDLES.map((c) => {
                  const top = priceToY(Math.max(c.o, c.c));
                  const height = Math.max(2, Math.abs(priceToY(c.o) - priceToY(c.c)));
                  return (
                    <rect
                      key={`b-${c.x}`}
                      x={c.x - 5}
                      y={top}
                      width="10"
                      height={height}
                      rx="1.5"
                      fill={c.up ? '#34d399' : '#f87171'}
                      opacity="0.85"
                    />
                  );
                })}

                {/* Sparkline overlay */}
                <polyline
                  points={SPARKLINE}
                  fill="none"
                  stroke="url(#cg)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="anim-chart-draw"
                />

                {/* Latest price dot */}
                <circle
                  cx={CANDLES[CANDLES.length - 1].x}
                  cy={priceToY(CANDLES[CANDLES.length - 1].c)}
                  r="3"
                  fill="#22d3ee"
                  style={{ animation: 'pulse-dot 1.6s ease-in-out infinite' }}
                />
              </svg>
            </div>
          </div>

          {/* Mini tickers row */}
          <div
            className="anim-fade-up grid grid-cols-3 gap-2"
            style={{ animationDelay: '0.3s' }}
          >
            {TICKERS.slice(0, 3).map((tk) => (
              <div
                key={tk.sym}
                className="rounded-xl border border-white/8 bg-white/[0.025] px-2.5 py-2 text-center"
              >
                <div className="text-[9px] uppercase tracking-[0.18em] text-slate-500">{tk.sym}</div>
                <div className="mt-0.5 text-xs font-semibold text-white">{tk.price}</div>
                <div
                  className={`mt-0.5 text-[10px] font-medium ${tk.up ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {tk.change}
                </div>
              </div>
            ))}
          </div>

          {/* Whale alert */}
          <div
            className="anim-fade-up anim-whale-glow flex items-center gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] px-4 py-3"
            style={{ animationDelay: '0.5s' }}
          >
            <span className="text-xl leading-none">🐋</span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-amber-200">Whale Alert</div>
              <div className="mt-0.5 truncate text-[10px] text-amber-200/60">
                3 lệnh lớn &gt;5 tỷ phát hiện hôm nay
              </div>
            </div>
            <div className="shrink-0 rounded-full bg-amber-300/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
              NEW
            </div>
          </div>

          {/* CVD / buy strength bar */}
          <div
            className="anim-fade-up rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3"
            style={{ animationDelay: '0.65s' }}
          >
            <div className="flex items-center justify-between text-[10px] text-slate-500">
              <span className="uppercase tracking-[0.18em]">CVD · Buy Strength</span>
              <span className="font-semibold text-cyan-300">62%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full"
                style={{
                  width: '62%',
                  background: 'linear-gradient(90deg,#22d3ee,#34d399)',
                  animation: 'grow-bar 1.4s cubic-bezier(0.4,0,0.2,1) 0.8s both',
                  transformOrigin: 'left',
                }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[9px] text-slate-600">
              <span>Bear</span>
              <span>Neutral</span>
              <span>Bull</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
