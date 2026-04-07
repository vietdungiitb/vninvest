import React, { useState } from 'react';
import { useI18n } from '../../context/LangContext';
import useTrustTelemetry from '../../hooks/useTrustTelemetry';

/**
 * S24-06 — RecommendationCardExplainability
 *
 * Props:
 *   advisory: { symbol, ai_summary, ai_detail, ai_provider, confidence?, created_at }
 *
 * "confidence" is optional on the advisory object — backends that populate it directly
 * show a numeric badge; older records fall back to parsing ai_summary heuristically.
 *
 * Invalidation: data is considered stale when freshness_seconds > 120 or
 * realtimeStatus === 'idle'.
 */
export default function RecommendationCardExplainability({
  advisory,
  freshnessSeconds = null,
  realtimeStatus = 'idle',
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const {
    trackExplainabilityOpened,
    trackExplainabilityInsufficient,
  } = useTrustTelemetry();

  if (!advisory) return null;

  const {
    symbol,
    ai_summary,
    ai_detail,
    ai_provider,
    confidence: rawConfidence,
  } = advisory;

  // Derive confidence: prefer explicit field, else parse % from ai_summary
  const confidence = (() => {
    if (rawConfidence != null) return Number(rawConfidence);
    const match = typeof ai_summary === 'string' && ai_summary.match(/(\d{1,3})%/);
    if (match) return Number(match[1]);
    return null;
  })();

  // Mark as stale if data is old or connection is idle
  const isStale = (freshnessSeconds != null && freshnessSeconds > 120)
    || realtimeStatus === 'idle';

  const confidenceColor = confidence == null
    ? 'text-gray-500'
    : confidence >= 70
      ? 'text-emerald-400'
      : confidence >= 40
        ? 'text-amber-400'
        : 'text-red-400';

  const hasSufficientData = Boolean(ai_summary);

  function handleToggle() {
    if (!hasSufficientData) {
      trackExplainabilityInsufficient(symbol, 'no_ai_summary');
      return;
    }
    const next = !open;
    if (next) trackExplainabilityOpened(symbol);
    setOpen(next);
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 text-sm">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-100">{symbol}</span>
          {confidence != null && (
            <span className={`text-xs font-semibold ${confidenceColor}`}>
              {t('explainability.confidence', { value: confidence, defaultValue: `Độ tin cậy ${confidence}%` })}
            </span>
          )}
          {isStale && (
            <span className="text-[11px] bg-amber-900/40 border border-amber-700 text-amber-300 px-1.5 py-0.5 rounded-full">
              {t('explainability.staleWarning', { defaultValue: 'Dữ liệu cũ — hãy làm mới' })}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
            hasSufficientData
              ? 'border-cyan-800 bg-cyan-950/30 text-cyan-400 hover:bg-cyan-950/50'
              : 'border-gray-700 bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
          title={!hasSufficientData ? t('explainability.noDataHint', { defaultValue: 'Chưa có phân tích AI' }) : undefined}
        >
          {open
            ? t('explainability.hideWhy', { defaultValue: '▲ Ẩn lý do' })
            : t('explainability.showWhy', { defaultValue: '▼ Tại sao?' })}
        </button>
      </div>

      {/* Expandable why section */}
      {open && (
        <div className="border-t border-slate-800 px-4 py-3 space-y-3">
          {ai_summary && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">
                {t('explainability.aiSummaryLabel', { defaultValue: 'Tổng kết AI' })}
              </p>
              <p className="text-xs leading-6 text-slate-300 whitespace-pre-line">
                {ai_summary}
              </p>
            </div>
          )}
          {ai_detail && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">
                {t('explainability.aiDetailLabel', { defaultValue: 'Phân tích chi tiết' })}
              </p>
              <p className="text-xs leading-6 text-slate-400 whitespace-pre-line max-h-48 overflow-y-auto">
                {ai_detail}
              </p>
            </div>
          )}
          {isStale && (
            <div className="rounded-lg border border-amber-800 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">
              ⚠️ {t('explainability.invalidationWarning', {
                defaultValue: 'Khuyến nghị này dựa trên dữ liệu cũ. Mức giá và tín hiệu thị trường có thể đã thay đổi.',
              })}
            </div>
          )}
          <div className="text-[11px] text-slate-600">
            {t('explainability.poweredBy', { provider: ai_provider || 'AI', defaultValue: `Được cung cấp bởi ${ai_provider || 'AI'}` })}
          </div>
        </div>
      )}
    </div>
  );
}
