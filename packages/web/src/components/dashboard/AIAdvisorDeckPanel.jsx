import React, { useMemo, useState, useEffect } from 'react';
import OptimizationModal from './OptimizationModal.jsx';

export default function AIAdvisorDeckPanel({
  holdings,
  technicals,
  alerts,
  analytics,
  digest,
  onRequestDigest,
  symbolScope = 'holdings',
  symbolOptions = [],
  t = (key, def) => def || key,
}) {
  const [showOptimization, setShowOptimization] = useState(false);

  useEffect(() => {
    if (symbolScope === 'holdings') {
      onRequestDigest?.();
    }
  }, [symbolScope, onRequestDigest]);

  const isHoldingsScope = symbolScope === 'holdings';

  const healthStats = useMemo(() => {
    if (!isHoldingsScope) {
      return { hasData: false, score: 0, grade: 'N/A', color: 'text-slate-500' };
    }

    const hasAnalytics = analytics && [
      analytics.sharpe_ratio,
      analytics.alpha_annual_pct,
      analytics.max_drawdown_pct,
    ].some((value) => value !== null && value !== undefined);

    if (!hasAnalytics) return { hasData: false, score: 0, grade: 'N/A', color: 'text-slate-500' };

    const sharpe = analytics.sharpe_ratio || 0;
    const alpha = analytics.alpha_annual_pct || 0;
    const maxDD = Math.abs(analytics.max_drawdown_pct || 0);

    const sharpeScore = Math.min(Math.max(sharpe / 2.5, 0), 1) * 40;
    const alphaScore = Math.min(Math.max(alpha / 20, 0), 1) * 30;
    const ddScore = (1 - Math.min(maxDD / 30, 1)) * 30;

    const total = Math.round(sharpeScore + alphaScore + ddScore);

    let grade = 'F';
    let color = 'text-rose-500';
    if (total >= 90) { grade = 'A+'; color = 'text-emerald-400'; }
    else if (total >= 80) { grade = 'A'; color = 'text-emerald-500'; }
    else if (total >= 70) { grade = 'B'; color = 'text-sky-400'; }
    else if (total >= 60) { grade = 'C'; color = 'text-amber-400'; }
    else if (total >= 40) { grade = 'D'; color = 'text-orange-400'; }

    return { hasData: true, score: total, grade, color };
  }, [analytics, isHoldingsScope]);

  const aiScopeTitle = useMemo(() => {
    if (symbolScope === 'holdings') return t('modernDeck.scopeHoldings', 'Đang nắm giữ');
    if (symbolScope === 'tracked') return t('modernDeck.scopeTracked', 'Theo dõi riêng');
    if (symbolScope === 'watchlist') return t('modernDeck.scopeWatchlist', 'Watchlist');
    return t('modernDeck.scopeAll', 'Tất cả');
  }, [symbolScope, t]);

  const aiMonitorSummary = useMemo(() => {
    if (isHoldingsScope) {
      return { symbolsCount: 0, bullishCount: 0, bearishCount: 0, neutralCount: 0 };
    }

    const symbolsCount = symbolOptions.length;
    const filteredTechnicals = (technicals || []).filter((item) => symbolOptions.includes(item.symbol));
    const bullishCount = filteredTechnicals.filter((item) => Number(item.momentum_20d_pct) > 0).length;
    const bearishCount = filteredTechnicals.filter((item) => Number(item.momentum_20d_pct) < 0).length;
    return {
      symbolsCount,
      bullishCount,
      bearishCount,
    };
  }, [isHoldingsScope, technicals, symbolOptions]);

  return (
    <div className="h-full overflow-y-auto panel-scrollbar p-6">
      {isHoldingsScope ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="flex flex-col items-center justify-center p-6 bg-slate-900/40 border border-slate-800 rounded-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10 text-4xl">🤖</div>
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-6">
              {t('modernDeck.aiHealthScoreTitle', 'Portfolio Health Score')}
            </h4>
            {healthStats.hasData ? (
              <>
                <div className="relative flex items-center justify-center w-32 h-32">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800" />
                    <circle
                      cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent"
                      strokeDasharray={364.4}
                      strokeDashoffset={364.4 - (364.4 * healthStats.score) / 100}
                      className={`${healthStats.color} transition-all duration-1000 ease-out`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-3xl font-black ${healthStats.color}`}>{healthStats.score}</span>
                    <span className="text-[10px] text-slate-500">/ 100</span>
                  </div>
                </div>

                <div className="mt-6 flex flex-col items-center">
                  <span className={`text-4xl font-black mb-1 ${healthStats.color}`}>{healthStats.grade}</span>
                  <span className="text-[10px] uppercase font-bold tracking-tighter text-slate-500">
                    {t('modernDeck.aiHealthScoreSubtitle', 'Thanh khoản & Hiệu suất')}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex min-h-[220px] flex-col items-center justify-center text-center text-slate-500">
                <div className="mb-3 text-4xl opacity-25">🧠</div>
                <p className="text-sm font-semibold text-slate-300">
                  {t('modernDeck.aiNoAnalyticsTitle', 'Chưa có dữ liệu phân tích')}
                </p>
                <p className="mt-1 max-w-xs text-xs text-slate-500">
                  {t('modernDeck.aiNoAnalyticsHelp', 'Health Score sẽ xuất hiện khi danh mục có đủ dữ liệu analytics để tính Sharpe, Alpha và drawdown.')}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4">
              <h5 className="text-xs font-bold text-emerald-400 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                {t('modernDeck.aiCommentaryTitle', 'AI Commentary')}
              </h5>
              <p className="text-sm text-slate-300 leading-relaxed italic">
                "{digest?.digest_summary || t('modernDeck.aiCommentaryEmpty', 'Chưa có bản tóm tắt AI cho danh mục này. Hệ thống sẽ hiển thị khi có đủ dữ liệu tổng hợp.')}"
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <span className="text-[9px] text-slate-500 uppercase block mb-1">
                  {t('modernDeck.aiSharpeLabel', 'Rủi ro (Sharpe)')}
                </span>
                <span className={`text-sm font-bold ${analytics?.sharpe_ratio >= 1.5 ? 'text-emerald-400' : 'text-slate-200'}`}>
                  {analytics?.sharpe_ratio ?? 'N/A'}
                </span>
              </div>
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                <span className="text-[9px] text-slate-500 uppercase block mb-1">
                  {t('modernDeck.aiDrawdownLabel', 'Sụt giảm tối đa')}
                </span>
                <span className="text-sm font-bold text-rose-400">
                  {analytics?.max_drawdown_pct ?? 'N/A'}{analytics?.max_drawdown_pct !== null && analytics?.max_drawdown_pct !== undefined ? '%' : ''}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowOptimization(true)}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-emerald-900/20"
            >
              {t('modernDeck.aiOptimizeButton', 'Tối ưu hóa danh mục với AI')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {t('modernDeck.aiMonitorModeHint', 'AI tab đang ở chế độ monitor theo scope hiện tại. Portfolio Health Score và nút tối ưu hóa chỉ áp dụng cho scope holdings.')}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">
                {t('modernDeck.aiMonitorScopeLabel', 'Scope hiện tại')}
              </div>
              <div className="mt-2 text-lg font-black text-slate-100">{aiScopeTitle}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">
                {t('modernDeck.aiMonitorSymbolsLabel', 'Số mã monitor')}
              </div>
              <div className="mt-2 text-2xl font-black text-slate-100">{aiMonitorSummary.symbolsCount}</div>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="text-[10px] uppercase tracking-wider text-emerald-300">
                {t('modernDeck.aiMonitorBullishLabel', 'Momentum dương')}
              </div>
              <div className="mt-2 text-2xl font-black text-emerald-300">{aiMonitorSummary.bullishCount}</div>
            </div>
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
              <div className="text-[10px] uppercase tracking-wider text-rose-300">
                {t('modernDeck.aiMonitorBearishLabel', 'Momentum âm')}
              </div>
              <div className="mt-2 text-2xl font-black text-rose-300">{aiMonitorSummary.bearishCount}</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              {t('modernDeck.aiMonitorCommentaryTitle', 'AI Monitor Commentary')}
            </h5>
            <p className="text-sm leading-relaxed text-slate-300 italic">
              "{digest?.digest_summary || t('modernDeck.aiCommentaryEmpty', 'Chưa có bản tóm tắt AI cho danh mục này. Hệ thống sẽ hiển thị khi có đủ dữ liệu tổng hợp.')}"
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              {t('modernDeck.aiMonitorFallbackTitle', 'Fallback behavior (scope non-holdings)')}
            </h5>
            <ul className="list-disc pl-5 space-y-1 text-xs text-slate-400">
              <li>{t('modernDeck.aiMonitorFallbackLine1', 'Portfolio Health Score được ẩn để tránh sai semantics.')}</li>
              <li>{t('modernDeck.aiMonitorFallbackLine2', 'Nút tối ưu hóa danh mục bị tắt ngoài scope holdings.')}</li>
              <li>{t('modernDeck.aiMonitorFallbackLine3', 'Nội dung AI tập trung theo monitor scope: symbols, momentum technical và digest hiện có.')}</li>
            </ul>
          </div>
        </div>
      )}

      {showOptimization && (
        <OptimizationModal
          onClose={() => setShowOptimization(false)}
          holdings={holdings}
          technicals={technicals}
          analytics={analytics}
          currentScore={healthStats.score}
          alerts={alerts}
        />
      )}
    </div>
  );
}
